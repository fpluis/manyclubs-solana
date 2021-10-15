export const handler = (event, context, callback) => {
  event.response.autoConfirmUser = true;
  callback(null, event);
};
