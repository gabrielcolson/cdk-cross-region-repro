import * as cdk from "aws-cdk-lib"
import * as pipelines from "aws-cdk-lib/pipelines"
import { Construct } from "constructs"
import { AppPipelineStage } from "./app-pipeline-stage"
import { AppStage } from "./app-stage"

const PRIMARY_REGION = "eu-west-1"
const SECONDARY_REGION = "us-east-1"

export class Pipeline extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props)

    const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      crossAccountKeys: true,
      dockerEnabledForSynth: true,
      synth: new pipelines.ShellStep("Synth", {
        input: pipelines.CodePipelineSource.connection(
          "gabrielcolson/cdk-cross-region-repro",
          "main",
          {
            connectionArn: this.node.tryGetContext("PIPELINE_CODESTAR_CONNECTION_ARN"),
          }
        ),
        commands: ["npm ci", "npm run build", "npx cdk synth"],
      }),
      useChangeSets: false, // speed up deployments
    })

    const account = this.node.tryGetContext("PROD_ACCOUNT")

    pipeline.addStage(
      new AppStage(this, `app-${PRIMARY_REGION}`, {
        env: {
          account,
          region: PRIMARY_REGION,
        },
      })
    )

    pipeline.addStage(
      new AppStage(this, `app-${SECONDARY_REGION}`, {
        env: {
          account,
          region: SECONDARY_REGION,
        },
      })
    )

    pipeline.addStage(
      new AppPipelineStage(this, "app-pipeline", {
        env: {
          account,
          region: PRIMARY_REGION,
        },
        secondaryRegion: SECONDARY_REGION,
      })
    )
  }
}

const pipelineEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: PRIMARY_REGION,
}

const app = new cdk.App()

new Pipeline(app, "cdk-cross-region-repro-dev", { env: pipelineEnv })

app.synth()
