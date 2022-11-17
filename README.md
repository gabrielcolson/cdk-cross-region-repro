# Reproduction repo for cross account & cross region CDK pipeline

![Reference Architecture](/images/pipeline.png)

## How to deploy

You need 2 accounts:

- a pipeline account, that will hold the CDK pipeline (`@aws-cdk/pipelines`). It needs to be bootstraped in the eu-west-1 region.
- an app account, that will hold the ecs cluster aswell as the app pipeline (`@aws-cdk/codepipeline`). It needs to be bootstraped in the eu-west-1 and us-east-1 and have a trust relationship with the pipeline account.

Fork this repository and create codestar connections in your 2 accounts. Update the variables in the `.projenrc.ts` and replace the account number in `main.ts` with your pipeline account. Then, run the following commands:

```sh
npm install
npx projen
git commit -am "chore: update context variables"
git push
npx cdk deploy cdk-cross-region-repro --profile nox-pipeline
```
