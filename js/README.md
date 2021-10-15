## Setup

Be sure to be running Node v12.16.2 and yarn version 1.22.10.

`yarn bootstrap`

Then run:

`yarn start`

You may have to rebuild your package more than one time to secure a
running environment.

### AWS Resources

To build the lambdas you need to have rollup installed. For that you can

```
npm install -g rollup
```

Then run:

```
rollup -c
```

On the cloudfront_auth folder, you need to have a config.json file with the following content:
```
{
  "REGION": // The AWS region where you have deployed the user pool
  "COGNITO_USER_POOL_ID": // You can find this on the AWS Console
  "JWKS": {...} // You can find this at https://cognito-idp.$REGION.amazonaws.com/$COGNITO_USER_POOL_ID/.well-known/jwks.json
}
```