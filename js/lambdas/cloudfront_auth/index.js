import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';
import jwkToPem from 'jwk-to-pem';
import { parse as parseQueryString } from 'querystring';
import { JWKS, REGION, COGNITO_USER_POOL_ID } from './config.json';
import { parseTokenMetadata } from '../utils/parse-metadata';
import validateWalletAccess from '../utils/validate-wallet-access';
import getAccountInfo from '../utils/get-account-info';

const dynamodb = new AWS.DynamoDB({ region: 'us-east-1' });

const iss = `https://cognito-idp.${REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
let pems;

pems = {};
const { keys } = JWKS;
for (let i = 0; i < keys.length; i++) {
  const keyId = keys[i].kid;
  const modulus = keys[i].n;
  const exponent = keys[i].e;
  const key_type = keys[i].kty;
  const jwk = { kty: key_type, n: modulus, e: exponent };
  const pem = jwkToPem(jwk);
  pems[keyId] = pem;
}

const unauthorizedResponse = {
  status: '401',
  statusDescription: 'Unauthorized',
};

const validateCognitoAuth = event =>
  new Promise(resolve => {
    const cfrequest = event.Records[0].cf.request;
    const { headers, querystring } = cfrequest;
    if (headers.authorization == null) {
      resolve({ isAuthed: false, reason: 'NoToken' });
    }

    const jwtToken = headers.authorization[0].value;
    // const { token: jwtToken } = parseQueryString(querystring);
    console.log(
      `Pems: ${JSON.stringify(pems)}; cfrequest ${JSON.stringify(
        cfrequest,
      )}; iss ${JSON.stringify(iss)}; headers ${JSON.stringify(
        headers,
      )}; query string ${JSON.stringify(querystring)} (parsed: ${JSON.stringify(
        parseQueryString(querystring),
      )}); jwt ${JSON.stringify(jwtToken)}`,
    );

    const decodedJwt = jwt.decode(jwtToken, { complete: true });
    console.log('Decoded Token', decodedJwt);
    if (!decodedJwt) {
      resolve({ isAuthed: false, reason: 'InvalidJWT' });
    }

    if (decodedJwt.payload.iss != iss) {
      resolve({ isAuthed: false, reason: 'InvalidIssuer' });
    }

    if (decodedJwt.payload.token_use != 'access') {
      console.log('Not an access token');
      resolve({ isAuthed: false, reason: 'IsNotAccessToken' });
    }

    const { kid } = decodedJwt.header;
    const pem = pems[kid];
    if (!pem) {
      resolve({ isAuthed: false, reason: 'InvalidAccessToken' });
    }

    jwt.verify(jwtToken, pem, { issuer: iss }, function (err, payload) {
      if (err) {
        resolve({ isAuthed: false, reason: 'TokenVerificationFailed' });
      } else {
        resolve({ isAuthed: true, decodedJwt });
      }
    });
  });

const getRequestParams = (uri, querystring) => {
  const {
    'list-type': bucketListType,
    delimiter = '/',
    prefix,
  } = parseQueryString(querystring);
  console.log(
    `Uri: ${uri}; list type ${JSON.stringify(
      bucketListType,
    )}; prefix ${JSON.stringify(prefix)}; delimiter ${delimiter}`,
  );
  if (uri === '/' && bucketListType === '2' && prefix != null) {
    // Prefixes have the shape "${key}/"
    return { type: 'list', key: prefix.split(delimiter)[0] };
  }

  // URIs have the shape "/${key}/${filename}.${extension}"
  return { type: 'object', key: uri.split(delimiter)[1] };
};

const getFileMetadata = async uri => {
  const params = {
    Key: {
      uri: {
        S: uri,
      },
    },
    TableName: 'files_metadata',
  };
  console.log(`Get file metadata with params ${JSON.stringify(params)}`);
  return dynamodb
    .getItem(params)
    .promise()
    .then(res => {
      console.log(
        `Get item with uri ${JSON.stringify(uri)}; Res: ${JSON.stringify(res)}`,
      );
      return res;
    })
    .then(
      ({
        Item: {
          visibility: { S: visibility },
        },
      }) => ({ visibility }),
    )
    .catch(error => {
      console.log(error);
    });
};

const checkPublicImageRequest = path => {
  const parts = path.split('/');
  const [, type, address] = parts;
  if (parts.length === 3 && ['avatar', 'banner'].includes(type)) {
    return {
      isPublicImageRequest: true,
      publicImageAddress: address.replace(/\..+$/, ''),
    };
  }

  return { isPublicImageRequest: false, publicImageAddress: null };
};

export const handler = async (event, context, callback) => {
  const [
    {
      cf: { request },
    },
  ] = event.Records;
  const { method, uri, querystring } = request;
  const { type: requestType, key: requestedKey } = getRequestParams(
    uri,
    querystring,
  );
  console.log(
    `Event: ${JSON.stringify(event)}; method: ${JSON.stringify(method)}`,
  );
  if (method === 'OPTIONS') {
    return request;
  }

  const { isPublicImageRequest, publicImageAddress } =
    checkPublicImageRequest(uri);
  if (method === 'GET') {
    if (isPublicImageRequest) {
      console.log(`Accepting GET on public image without authorization`);
      callback(null, request);
      return request;
    }

    if (requestType === 'object') {
      const tokenMetadata = await getAccountInfo(requestedKey)
        .then(response => parseTokenMetadata(response))
        .catch(error => {
          console.log(`Error parsing metadata:`, error);
        });
      const {
        info: {
          updateAuthority,
          data: { name },
        },
      } = tokenMetadata;
      const path = encodeURIComponent(name.toLowerCase());
      const actualUri = uri.replace(
        new RegExp(`^/${requestedKey}`, 'i'),
        `/${updateAuthority}/${path}`,
      );
      const { visibility } = await getFileMetadata(actualUri);
      if (visibility === 'public') {
        console.log(`Accepting GET on public image without authorization`);
        request.uri = actualUri;
        callback(null, request);
        return request;
      }
    }
  }

  const { isAuthed, decodedJwt, reason } = await validateCognitoAuth(
    event,
  ).catch(error => {
    console.log(`Error authenticating user`, error);
    callback(null, unauthorizedResponse);
    return request;
  });
  if (!isAuthed) {
    console.log(`Failed to check cognito auth. Reason: ${reason}`);
    callback(null, unauthorizedResponse);
    return request;
  }

  const {
    payload: { username: userAddress },
  } = decodedJwt;

  if (isPublicImageRequest) {
    console.log(`Making public image request to ${publicImageAddress} from ${userAddress}`);
    if (method === 'PUT' && userAddress !== publicImageAddress) {
      console.log(`User does not own the requested access token`);
      callback(null, unauthorizedResponse);
      return request;
    }

    console.log(
      `Proceeding with public image request to ${publicImageAddress}`,
    );
    delete request.headers.authorization;
    callback(null, request);
    return request;
  }

  console.log(
    `User address: ${JSON.stringify(
      userAddress,
    )}; method: ${method}; uri ${uri}; querystring ${querystring}; request type ${requestType}; requested key ${requestedKey}`,
  );
  const { isOwner, updateAuthority, path, hasSubscriberAccess } =
    await validateWalletAccess(requestedKey, userAddress);
  if (!isOwner) {
    console.log(`User does not own the requested access token`);
    callback(null, unauthorizedResponse);
    return request;
  }

  console.log(
    `User owns the token; method ${method}, has update authority? ${
      userAddress === updateAuthority
    }`,
  );
  if (method !== 'GET' && userAddress !== updateAuthority) {
    console.log(`User does not have edit permissions`);
    callback(null, unauthorizedResponse);
    return request;
  }

  delete request.headers.authorization;
  if (requestType === 'list') {
    request.querystring = request.querystring.replace(
      new RegExp(`prefix=${requestedKey}/`, 'i'),
      `prefix=${updateAuthority}/${path}/`,
    );
    console.log(
      `Updated to a list request: ${JSON.stringify(request, null, 2)}`,
    );
    callback(null, request);
    return request;
  }

  const actualUri = uri.replace(
    new RegExp(`^/${requestedKey}`, 'i'),
    `/${updateAuthority}/${path}`,
  );
  console.log(`Actual uri: ${actualUri}`);
  if (method === 'GET') {
    const { visibility } = await getFileMetadata(actualUri);
    console.log(`Visibility of ${actualUri}: ${visibility}`);
    if (
      (visibility === 'community' && !isOwner) ||
      (visibility === 'subscribers' && (!isOwner || !hasSubscriberAccess))
    ) {
      console.log(
        `User does not have access to uri ${actualUri} with visibility ${visibility}`,
      );
      callback(null, unauthorizedResponse);
      return request;
    }
  }

  request.uri = actualUri;
  console.log(
    `Updated to a get-single-object request: ${JSON.stringify(
      request,
      null,
      2,
    )}`,
  );
  callback(null, request);
  return request;
};
