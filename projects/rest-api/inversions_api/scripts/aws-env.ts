import { ElasticBeanstalkClient, UpdateEnvironmentCommand } from "@aws-sdk/client-elastic-beanstalk";
import * as fs from "fs";

const REGION = "us-east-1";
const APP_NAME = "app-inversiones";
const ENV_NAME = "app-inversiones-env";

const ebClient = new ElasticBeanstalkClient({ region: REGION });

async function updateEnvVars() {
  try {
    console.log("Leyendo archivo .env local...");
    const envContent = fs.readFileSync("projects/rest-api/inversions_api/.env", "utf-8");
    
    const optionSettings = [];
    
    const lines = envContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        
        optionSettings.push({
          Namespace: "aws:elasticbeanstalk:application:environment",
          OptionName: key,
          Value: value
        });
      }
    }
    
    // Add NODE_ENV explicit
    optionSettings.push({
      Namespace: "aws:elasticbeanstalk:application:environment",
      OptionName: "NODE_ENV",
      Value: "production"
    });

    console.log(`Enviando ${optionSettings.length} variables de entorno a AWS Elastic Beanstalk...`);
    
    await ebClient.send(new UpdateEnvironmentCommand({
      ApplicationName: APP_NAME,
      EnvironmentName: ENV_NAME,
      OptionSettings: optionSettings
    }));
    
    console.log("Variables actualizadas con éxito. AWS reiniciará el entorno en breve para aplicarlas.");
  } catch (error) {
    console.error("Error actualizando variables:", error);
  }
}

updateEnvVars();
