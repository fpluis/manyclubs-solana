## Installing

Clone the repo, and run `yarn start` to deploy.

```bash
$ git clone https://github.com/metaplex-foundation/metaplex.git
$ cd metaplex
$ cd js
$ yarn install
$ yarn bootstrap
$ yarn start
```

This will start up a local dev server. To deploy the infrastructure, run the following commands from the project's root:
```bash
$ cd js
$ rollup -c
$ terraform init
$ terraform apply
```

The client will ask for a few variables needed for the deployment of infrastructure. See main.tf for the vars required.

## Metaplex

This repo was originally cloned from [Metaplex](https://github.com/metaplex-foundation/metaplex) and then extended with custom functionality.