import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';
import toProxyResponse from '../utils/to-proxy-response';

const dynamodb = new AWS.DynamoDB();

const putCreator = (body, address) => {
  const postBody = JSON.parse(body);
  console.log(`Post body: ${JSON.stringify(postBody)}`);
  console.log(postBody);
  const { username, image, description, banner } = postBody;
  const params = {
    Item: {
      address: { S: address },
      username: { S: username },
      image: { S: image },
      description: { S: description },
    },
    TableName: 'creators',
  };

  if (banner != null) {
    params.Item.banner = {
      S: banner,
    };
  }

  console.log(`Calling dynamodb with params ${JSON.stringify(params)}`);
  return dynamodb.putItem(params).promise();
};

const getCreators = () => {
  const params = {
    TableName: 'creators',
  };
  return dynamodb
    .scan(params)
    .promise()
    .then(({ Items }) =>
      Items.map(
        ({
          address: { S: address },
          username: { S: username },
          image: { S: image },
          description: { S: description },
          banner: { S: banner } = { S: '' },
        }) => {
          return {
            username,
            image,
            description,
            banner,
            address,
          };
        },
      ),
    );
};

const getCreator = address => {
  const params = {
    TableName: 'creators',
    Key: {
      address: {
        S: address,
      },
    },
    ProjectionExpression: 'address, username, image, description, banner',
  };
  return dynamodb
    .getItem(params)
    .promise()
    .then(response => {
      console.log(`Get item response: ${response}`);
      if (response.Item == null) {
        return {};
      }

      const {
        Item: {
          address: { S: address },
          username: { S: username },
          image: { S: image },
          description: { S: description },
          banner: { S: banner } = { S: '' },
        },
      } = response;
      return {
        username,
        image,
        description,
        banner,
        address,
      };
    });
};

export const handler = async (event, context, callback) => {
  console.log(`Event: ${JSON.stringify(event)}`);
  const { headers, body, httpMethod, pathParameters } = event;
  const tokenString = headers['Authorization'];
  console.log(`Token string: ${tokenString}`);
  const {
    payload: { 'cognito:username': pubkey },
  } = jwt.decode(tokenString, { complete: true });
  const { address } = pathParameters || {};
  if (httpMethod === 'GET') {
    if (address == null) {
      const creators = await getCreators();
      console.log(`Creators: ${JSON.stringify(creators)}`);
      callback(null, toProxyResponse(creators));
    } else {
      const creator = await getCreator(address);
      console.log(`Creator: ${JSON.stringify(creator)}`);
      callback(null, toProxyResponse(creator));
    }

    return;
  }

  // Check creator have the authority to update themselves
  if (httpMethod === 'PUT' && pubkey === address) {
    console.log(`Put creator`);
    const response = await putCreator(body, address);
    callback(null, toProxyResponse(response));
    return;
  }

  console.log(`Unhandled http method used: ${httpMethod}`);
  return;
};
