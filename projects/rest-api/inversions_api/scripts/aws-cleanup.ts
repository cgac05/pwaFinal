import { CodePipelineClient, ListPipelinesCommand, DeletePipelineCommand } from "@aws-sdk/client-codepipeline";

const REGION = "us-east-1";

async function cleanupPipelines() {
  const client = new CodePipelineClient({ region: REGION });
  try {
    console.log(`Buscando pipelines en ${REGION}...`);
    const command = new ListPipelinesCommand({});
    const response = await client.send(command);

    const pipelines = response.pipelines || [];
    if (pipelines.length === 0) {
      console.log("No se encontraron pipelines.");
      return;
    }

    console.log(`Se encontraron ${pipelines.length} pipelines.`);
    for (const pipeline of pipelines) {
      if (pipeline.name) {
        console.log(`Eliminando pipeline: ${pipeline.name}...`);
        const deleteCmd = new DeletePipelineCommand({ name: pipeline.name });
        await client.send(deleteCmd);
        console.log(`Pipeline ${pipeline.name} eliminado exitosamente.`);
      }
    }
  } catch (error) {
    console.error("Error al limpiar pipelines:", error);
  }
}

cleanupPipelines();
