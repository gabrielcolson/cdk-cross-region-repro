import * as cdk from "aws-cdk-lib"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as codepipeline from "aws-cdk-lib/aws-codepipeline"
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as ecr from "aws-cdk-lib/aws-ecr"
import * as ecs from "aws-cdk-lib/aws-ecs"
import { Construct } from "constructs"
import { SSMParameterReader } from "./ssm-parameter-reader"

export class AppPipelineStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: cdk.StageProps & { secondaryRegion: string }) {
    super(scope, id, props)

    const stack = new cdk.Stack(this, "Pipeline")

    const ecrRepository = new ecr.Repository(stack, "Repository")

    const apiPipeline = new codepipeline.Pipeline(stack, "Pipeline", {
      crossAccountKeys: false,
    })

    const sourceOutput = new codepipeline.Artifact()
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GithubSource",
      connectionArn: this.node.tryGetContext("PROD_CODESTAR_CONNECTION_ARN"),
      output: sourceOutput,
      owner: "gabrielcolson",
      repo: "cdk-cross-region-repro",
      branch: "app",
    })
    apiPipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    })

    const codebuildProject = new codebuild.PipelineProject(stack, "CodeBuildProject", {
      environment: {
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: [
              "$(aws ecr get-login --region $AWS_DEFAULT_REGION --no-include-email)",
              "docker build -t $REPOSITORY_URI:latest .",
              "docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION",
            ],
          },
          post_build: {
            commands: [
              "docker push $REPOSITORY_URI:latest",
              "docker push $REPOSITORY_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION",
              "export imageTag=$CODEBUILD_RESOLVED_SOURCE_VERSION",
              'printf \'[{"name":"web","imageUri":"%s"}]\' $REPOSITORY_URI:$imageTag > imagedefinitions.json',
            ],
          },
        },
        env: {
          // save the imageTag environment variable as a CodePipeline Variable
          "exported-variables": ["imageTag"],
        },
        artifacts: {
          files: ["imagedefinitions.json"],
        },
      }),
      environmentVariables: {
        REPOSITORY_URI: { value: ecrRepository.repositoryUri },
      },
    })

    ecrRepository.grantPullPush(codebuildProject)

    const buildOutput = new codepipeline.Artifact()
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "CodeBuild",
      project: codebuildProject,
      input: sourceOutput,
      outputs: [buildOutput],
      executeBatchBuild: false,
    })
    apiPipeline.addStage({
      stageName: "Build",
      actions: [buildAction],
    })

    const primaryService = getEcsService(stack, stack.region)
    const deployPrimaryAction = new codepipeline_actions.EcsDeployAction({
      actionName: "Deploy",
      service: primaryService,
      input: buildOutput,
    })
    apiPipeline.addStage({
      stageName: "Deploy-Primary",
      actions: [deployPrimaryAction],
    })

    const secondaryService = getEcsService(stack, props.secondaryRegion)
    const deploySecondaryAction = new codepipeline_actions.EcsDeployAction({
      actionName: "Deploy",
      service: secondaryService,
      input: buildOutput,
    })
    apiPipeline.addStage({
      stageName: "Deploy-Secondary",
      actions: [deploySecondaryAction],
    })
  }
}

const getEcsService = (scope: Construct, region: string) => {
  const serviceName = new SSMParameterReader(scope, `service-name-${region}`, {
    parameterName: "/pipeline-repro/app/service-name",
    region,
  })

  const clusterName = new SSMParameterReader(scope, `cluster-name-${region}`, {
    parameterName: "/pipeline-repro/app/cluster-name",
    region,
  })

  const serviceArn = cdk.Arn.format({
    partition: "aws",
    service: "ecs",
    resource: "service",
    resourceName: `${clusterName.getParameterValue()}/${serviceName.getParameterValue()}`,
    account: cdk.Stack.of(scope).account,
    region,
  })

  return ecs.BaseService.fromServiceArnWithCluster(scope, `Service-${region}`, serviceArn)
}
