import * as cdk from "aws-cdk-lib"
import * as ecs from "aws-cdk-lib/aws-ecs"
import * as ecs_patterns from "aws-cdk-lib/aws-ecs-patterns"
import * as iam from "aws-cdk-lib/aws-iam"
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from "constructs"

export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props)

    const stack = new cdk.Stack(this, "App")

    const app = new ecs_patterns.ApplicationLoadBalancedFargateService(stack, "App", {
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry("amazon/amazon-ecs-sample"),
      },
    })

    app.taskDefinition.addToExecutionRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        actions: [
          "ecr:getauthorizationtoken",
          "ecr:batchchecklayeravailability",
          "ecr:getdownloadurlforlayer",
          "ecr:batchgetimage",
        ],
      })
    )

    new ssm.StringParameter(stack, "ServiceName", {
      parameterName: `/pipeline-repro/app/service-name`,
      stringValue: app.service.serviceName,
    })
    new ssm.StringParameter(stack, "ClusterName", {
      parameterName: `/pipeline-repro/app/cluster-name`,
      stringValue: app.cluster.clusterName,
    })
  }
}
