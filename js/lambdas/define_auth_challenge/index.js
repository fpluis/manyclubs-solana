// export const handler = async (event, context, callback) => {
//   console.log(`Handling define_auth_challenge; event ${JSON.stringify(event)}`);
//   if (
//     event.request.session.length == 1 &&
//     event.request.session[0].challengeName == "SRP_A"
//   ) {
//     event.response.issueTokens = false;
//     event.response.failAuthentication = false;
//     event.response.challengeName = "CUSTOM_CHALLENGE";
//   } else if (
//     event.request.session.length == 2 &&
//     event.request.session[1].challengeName == "CUSTOM_CHALLENGE" &&
//     event.request.session[1].challengeResult == true
//   ) {
//     event.response.issueTokens = true;
//     event.response.failAuthentication = false;
//   } else {
//     event.response.issueTokens = false;
//     event.response.failAuthentication = true;
//   }

//   console.log(`Response: ${JSON.stringify(event)}`);
//   callback(null, event);
// };

export const handler = async event => {
  console.log(`Handling define_auth_challenge; event ${JSON.stringify(event)}`);
  if (
    event.request.session &&
    event.request.session.find(
      attempt => attempt.challengeName !== 'CUSTOM_CHALLENGE',
    )
  ) {
    // We only accept custom challenges; fail auth
    console.log(`Fail auth`);
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (
    event.request.session &&
    event.request.session.length &&
    event.request.session[0].challengeName === 'CUSTOM_CHALLENGE' &&
    event.request.session[0].challengeResult === true
  ) {
    console.log(`Succeed auth`);
    // The user provided the right answer; succeed auth
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    console.log(`Start auth`);
    // The user did not provide a correct answer yet; present challenge
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  }

  return event;
};
