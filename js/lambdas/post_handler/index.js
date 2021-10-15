import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';
import toProxyResponse from '../utils/to-proxy-response';
import validateWalletAccess from '../utils/validate-wallet-access';

const dynamodb = new AWS.DynamoDB();

const setFileMetadata = (uri, { visibility }) => {
  console.log(
    `Call dynamodb with ${JSON.stringify({
      Item: {
        uri: {
          S: uri,
        },
        visibility: {
          S: visibility,
        },
      },
      TableName: 'files_metadata',
    })}`,
  );
  return dynamodb
    .putItem({
      Item: {
        uri: {
          S: uri,
        },
        visibility: {
          S: visibility,
        },
      },
      TableName: 'files_metadata',
    })
    .promise();
};

const createPost = ({
  body,
  updateAuthority,
  requestedKey,
  path: communityPath,
  community,
  pubkey,
}) => {
  const postBody = JSON.parse(body);
  console.log(`Post body: ${JSON.stringify(postBody)}`);
  console.log(postBody);
  const { content, visibility, filePaths = [] } = postBody;
  const params = {
    Item: {
      community: {
        S: community,
      },
      author: {
        S: pubkey,
      },
      visibility: {
        S: visibility,
      },
      creationDate: {
        S: new Date().toISOString(),
      },
      content: {
        S: content,
      },
    },
    TableName: 'posts',
  };

  if (filePaths.length > 0) {
    params.Item.filePaths = {
      SS: filePaths,
    };
  }

  console.log(`Calling dynamodb with params ${JSON.stringify(params)}`);
  return dynamodb
    .putItem(params)
    .promise()
    .then(async response => {
      await Promise.all(
        filePaths.map(path => {
          console.log(
            `Add file metadata with update auth ${updateAuthority}; path ${communityPath}`,
          );
          const { pathname: actualUri } = new URL(
            path.replace(
              new RegExp(`/${requestedKey}`, 'i'),
              `/${updateAuthority}/${communityPath}`,
            ),
          );
          console.log(`Actual uri: ${actualUri}`);
          return setFileMetadata(actualUri, { visibility });
        }),
      ).catch(error => {
        console.log(`Error updating file metadata:`);
        console.log(error);
      });
      return response;
    });
};

const getCommunityPosts = (community, isOwner, hasSubscriberAccess) => {
  const params = {
    ExpressionAttributeValues: {
      ':community': {
        S: community,
      },
    },
    ScanIndexForward: false,
    KeyConditionExpression: 'community = :community',
    ProjectionExpression:
      'author, creationDate, content, visibility, filePaths',
    TableName: 'posts',
  };
  return dynamodb
    .query(params)
    .promise()
    .then(({ Items }) =>
      Items.map(
        ({
          author: { S: author },
          visibility: { S: visibility },
          creationDate: { S: creationDate },
          content: { S: content },
          filePaths: { SS: filePaths } = { SS: [] },
        }) => {
          const publicProps = {
            author,
            visibility,
            creationDate,
          };
          if (
            visibility === 'public' ||
            (visibility === 'community' && isOwner) ||
            (visibility === 'subscribers' && isOwner && hasSubscriberAccess)
          ) {
            return {
              ...publicProps,
              content,
              filePaths,
            };
          }

          return publicProps;
        },
      ),
    );
};

const getLatestPosts = () => {
  const params = {
    IndexName: 'DateIndex',
    ScanIndexForward: false,
    KeyConditionExpression: 'visibility = :visibility',
    ExpressionAttributeValues: { ':visibility': { S: 'public' } },
    TableName: 'posts',
  };
  return dynamodb
    .query(params)
    .promise()
    .then(({ Items }) =>
      Items.map(
        ({
          community: { S: community },
          author: { S: author },
          visibility: { S: visibility },
          creationDate: { S: creationDate },
          content: { S: content },
          filePaths: { SS: filePaths } = { SS: [] },
        }) => {
          return {
            community,
            author,
            visibility,
            creationDate,
            content,
            filePaths,
          };
        },
      ),
    );
};

export const handler = async (event, context, callback) => {
  console.log(`Event: ${JSON.stringify(event)}`);
  const { headers, body, httpMethod, pathParameters } = event;
  const tokenString = headers['Authorization'];
  console.log(`Token string: ${tokenString}`);
  const {
    payload: { 'cognito:username': pubkey },
  } = jwt.decode(tokenString, { complete: true });
  const { community: requestedKey } = pathParameters || {};
  console.log(`Username: ${pubkey}; requested key: ${requestedKey}`);
  if (requestedKey == null) {
    if (httpMethod != 'GET') {
      console.log(`Non-GET method on root resource`);
      callback(null, {
        statusCode: '404',
        statusDescription,
      });
      return;
    }

    const posts = await getLatestPosts();
    console.log(`Latest posts: ${JSON.stringify(posts)}`);
    callback(null, toProxyResponse(posts));
    return;
  }

  const { isOwner, mint, path, updateAuthority, hasSubscriberAccess } =
    await validateWalletAccess(requestedKey, pubkey);
  console.log(
    `Is owner? ${isOwner}; mint ${mint}; update authority ${updateAuthority}; has subscriber access? ${hasSubscriberAccess}; path: ${path}`,
  );

  if (httpMethod === 'GET') {
    const posts = await getCommunityPosts(mint, isOwner, hasSubscriberAccess);
    console.log(`Community posts: ${JSON.stringify(posts)}`);
    callback(null, toProxyResponse(posts));
    return;
  }

  if (!isOwner) {
    const statusDescription = `User does not have access to this community`;
    console.log(statusDescription);
    callback(null, {
      statusCode: '401',
      statusDescription,
    });
    return;
  }

  if (pubkey !== updateAuthority) {
    const statusDescription = `User does not have update authority on this community`;
    console.log(statusDescription);
    callback(null, {
      statusCode: '401',
      statusDescription,
    });
    return;
  }

  if (httpMethod === 'PUT') {
    console.log(`Create post`);
    const response = await createPost({
      body,
      path,
      updateAuthority,
      requestedKey,
      community: mint,
      pubkey,
    });
    callback(null, toProxyResponse(response));
    return;
  }

  console.log(`Unhandled http method used: ${httpMethod}`);
  return;
};
