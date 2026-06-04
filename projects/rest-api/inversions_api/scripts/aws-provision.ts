import { ElasticBeanstalkClient, CreateApplicationCommand, CreateEnvironmentCommand, DescribeApplicationsCommand, DescribeEnvironmentsCommand, CheckDNSAvailabilityCommand } from "@aws-sdk/client-elastic-beanstalk";
import { IAMClient, GetInstanceProfileCommand, CreateInstanceProfileCommand, CreateRoleCommand, AddRoleToInstanceProfileCommand, AttachRolePolicyCommand } from "@aws-sdk/client-iam";

const REGION = "us-east-1";
const APP_NAME = "app-inversiones";
const ENV_NAME = "app-inversiones-env";
const CNAME_PREFIX = "app-inversiones-pwa";

// AWS SDK Clients
const ebClient = new ElasticBeanstalkClient({ region: REGION });
const iamClient = new IAMClient({ region: REGION });

const ROLE_NAME = "aws-elasticbeanstalk-ec2-role";

async function ensureIAMRoleExists() {
  console.log(`Verificando perfil de instancia IAM: ${ROLE_NAME}...`);
  try {
    await iamClient.send(new GetInstanceProfileCommand({ InstanceProfileName: ROLE_NAME }));
    console.log("El perfil de instancia ya existe.");
  } catch (error: any) {
    if (error.name === "NoSuchEntityException") {
      console.log("Creando rol y perfil de instancia...");
      
      const assumeRolePolicyDocument = JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Principal: { Service: "ec2.amazonaws.com" }, Action: "sts:AssumeRole" }]
      });

      await iamClient.send(new CreateRoleCommand({ RoleName: ROLE_NAME, AssumeRolePolicyDocument: assumeRolePolicyDocument }));
      await iamClient.send(new AttachRolePolicyCommand({ RoleName: ROLE_NAME, PolicyArn: "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier" }));
      await iamClient.send(new AttachRolePolicyCommand({ RoleName: ROLE_NAME, PolicyArn: "arn:aws:iam::aws:policy/AWSElasticBeanstalkMulticontainerDocker" }));
      await iamClient.send(new AttachRolePolicyCommand({ RoleName: ROLE_NAME, PolicyArn: "arn:aws:iam::aws:policy/AWSElasticBeanstalkWorkerTier" }));
      
      await iamClient.send(new CreateInstanceProfileCommand({ InstanceProfileName: ROLE_NAME }));
      await iamClient.send(new AddRoleToInstanceProfileCommand({ InstanceProfileName: ROLE_NAME, RoleName: ROLE_NAME }));

      console.log("Rol y perfil creados exitosamente. Esperando propagación (10s)...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } else {
      throw error;
    }
  }
}

async function provisionAWS() {
  try {
    await ensureIAMRoleExists();

    // 1. Verificar/Crear Aplicación
    console.log(`Verificando aplicación ${APP_NAME}...`);
    const appsRes = await ebClient.send(new DescribeApplicationsCommand({ ApplicationNames: [APP_NAME] }));
    if (!appsRes.Applications || appsRes.Applications.length === 0) {
      console.log(`Creando aplicación ${APP_NAME}...`);
      await ebClient.send(new CreateApplicationCommand({ ApplicationName: APP_NAME, Description: "Inversiones PWA & API" }));
    }

    // 2. Verificar/Crear Entorno
    console.log(`Verificando entorno ${ENV_NAME}...`);
    const envsRes = await ebClient.send(new DescribeEnvironmentsCommand({ ApplicationName: APP_NAME, EnvironmentNames: [ENV_NAME] }));
    let envExists = false;
    if (envsRes.Environments && envsRes.Environments.length > 0) {
      const status = envsRes.Environments[0].Status;
      if (status !== "Terminated") {
        envExists = true;
        console.log(`El entorno ya existe (Status: ${status}).`);
      }
    }

    if (!envExists) {
      console.log(`Verificando disponibilidad de DNS: ${CNAME_PREFIX}...`);
      const dnsRes = await ebClient.send(new CheckDNSAvailabilityCommand({ CNAMEPrefix: CNAME_PREFIX }));
      if (!dnsRes.Available) {
        console.warn(`PRECAUCIÓN: El dominio ${CNAME_PREFIX} no está disponible. Se generará uno automáticamente o fallará si lo forzamos.`);
      }

      console.log(`Creando entorno ${ENV_NAME}...`);
      const createEnvParams = {
        ApplicationName: APP_NAME,
        EnvironmentName: ENV_NAME,
        CNAMEPrefix: CNAME_PREFIX,
        // Usamos Node.js 20 sobre Amazon Linux 2023
        SolutionStackName: "64bit Amazon Linux 2023 v6.11.1 running Node.js 20",
        Tier: { Name: "WebServer", Type: "Standard", Version: "1.0" },
        OptionSettings: [
          { Namespace: "aws:autoscaling:launchconfiguration", OptionName: "IamInstanceProfile", Value: ROLE_NAME },
          { Namespace: "aws:elasticbeanstalk:application:environment", OptionName: "NODE_ENV", Value: "production" }
        ]
      };
      
      await ebClient.send(new CreateEnvironmentCommand(createEnvParams));
      console.log("Comando de creación enviado exitosamente. Toma unos minutos inicializarse en AWS.");
    }
    
    console.log("Aprovisionamiento de Elastic Beanstalk completado.");
  } catch (error) {
    console.error("Error durante el aprovisionamiento:", error);
  }
}

provisionAWS();
