export const handler = (event, context, callback) => {
  const response = event.Records[0].cf.response;
  const headers = response.headers;
  if ('origin' in event.Records[0].cf.request.headers) {
    headers['Access-Control-Allow-Origin'] = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
    ];
    headers['Access-Control-Allow-Methods'] = [
      { key: 'Access-Control-Allow-Methods', value: '*' },
    ];
    headers['Access-Control-Allow-Headers'] = [
      { key: 'Access-Control-Allow-Headers', value: '*' },
    ];
    headers['Access-Control-Max-Age'] = [
      { key: 'Access-Control-Max-Age', value: '7200' },
    ];
  }

  console.log(`Return response ${JSON.stringify(response)}`);
  callback(null, response);
};
