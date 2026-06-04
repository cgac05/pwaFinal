import { Octokit } from "@octokit/rest";
import sodium from "libsodium-wrappers";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const OWNER = "cgac05";
const REPO = "pwaFinal";

const SECRETS = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!
};

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function setSecrets() {
  try {
    await sodium.ready;
    console.log(`Obteniendo llave pública del repositorio ${OWNER}/${REPO}...`);
    const { data: { key, key_id } } = await octokit.actions.getRepoPublicKey({
      owner: OWNER,
      repo: REPO,
    });

    for (const [secretName, secretValue] of Object.entries(SECRETS)) {
      console.log(`Encriptando secreto ${secretName}...`);
      
      const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
      const binsec = sodium.from_string(secretValue);
      const encBytes = sodium.crypto_box_seal(binsec, binkey);
      const encryptedValue = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

      console.log(`Subiendo secreto ${secretName}...`);
      await octokit.actions.createOrUpdateRepoSecret({
        owner: OWNER,
        repo: REPO,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: key_id,
      });
      console.log(`${secretName} subido con éxito.`);
    }

    console.log("Secretos subidos correctamente.");
    
    // Disparar nuevamente el workflow fallido
    console.log("Obteniendo último workflow run fallido para reintentar...");
    const runs = await octokit.actions.listWorkflowRunsForRepo({
      owner: OWNER,
      repo: REPO,
      per_page: 5
    });
    
    const latestRun = runs.data.workflow_runs.find(r => r.name === "Deploy to AWS Elastic Beanstalk");
    if (latestRun) {
      console.log(`Relanzando workflow ${latestRun.id}...`);
      await octokit.actions.reRunWorkflow({
        owner: OWNER,
        repo: REPO,
        run_id: latestRun.id
      });
      console.log("Workflow relanzado con éxito. Ahora sí debería leer las llaves de AWS.");
    }
  } catch (error) {
    console.error("Error gestionando secretos de GitHub:", error);
  }
}

setSecrets();
