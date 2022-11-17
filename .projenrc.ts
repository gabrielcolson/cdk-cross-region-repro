import { awscdk, javascript } from "projen"

const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: "2.1.0",
  defaultReleaseBranch: "main",
  name: "lapsus-nox-infra-v2",
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,

  depsUpgradeOptions: {
    workflow: false,
  },

  prettier: true,
  prettierOptions: {
    settings: {
      semi: false,
      printWidth: 100,
    },
  },

  context: {
    PIPELINE_CODESTAR_CONNECTION_ARN:
      "arn:aws:codestar-connections:eu-west-1:332715547081:connection/87ed22d8-03b5-4df6-aff5-a3c84ba4e2f7",
    PROD_CODESTAR_CONNECTION_ARN:
      "arn:aws:codestar-connections:us-east-1:996335177016:connection/3b2589ce-de77-4d6f-befa-ea7482319260",
    PROD_ACCOUNT: "996335177016",
  },
})
project.synth()
