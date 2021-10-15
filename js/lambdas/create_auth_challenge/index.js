import crypto from "crypto";

export const handler = (event, context, callback) => {
  console.log(`Handling create_auth_challenge; event ${JSON.stringify(event)}`);
  const { request: { session }, userName } = event;
  if (!session || session.length === 0) {
    const challenge = crypto.randomBytes(64).toString("hex");
    event.response.publicChallengeParameters = {
      challenge,
    };
    event.response.privateChallengeParameters = { publicKey: userName, challenge };
    console.log(
      `privateChallengeParameters: ${JSON.stringify(
        event.response.privateChallengeParameters
      )}`
    );
  }

  console.log(`Sending response ${JSON.stringify(event)}`);
  callback(null, event);
};
