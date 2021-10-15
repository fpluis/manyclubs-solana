export default (body, statusCode = 200) => {
  const response = {
    statusCode,
    headers: {
      'Access-Control-Max-Age': '7200',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    },
  };
  if (body == null) {
    return response;
  }

  return {
    ...response,
    body: JSON.stringify(body),
  };
};
