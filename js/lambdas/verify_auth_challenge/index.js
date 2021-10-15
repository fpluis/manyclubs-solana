// import crypto from "crypto";
import tweetnacl from 'tweetnacl';
import bs58 from 'bs58';

export const handler = async event => {
  console.log(`Handling verify_auth_challenge; event ${JSON.stringify(event)}`);
  const {
    request: {
      challengeAnswer,
      privateChallengeParameters: { challenge, publicKey },
    },
  } = event;

  const signature = JSON.parse(challengeAnswer);
  const encoder = new TextEncoder();
  const publicKeyBytes = bs58.decode(publicKey);
  console.log(
    `Verifying using challenge ${challenge} (${JSON.stringify(
      encoder.encode(challenge),
    )}); signature ${JSON.stringify(
      Buffer.from(signature.data),
    )} and public key ${publicKey} (${JSON.stringify(
      publicKeyBytes,
    )}); tweetnacl constants: public key length ${
      tweetnacl.sign.publicKeyLength
    }; signature length ${tweetnacl.sign.signatureLength}`,
  );

  event.response.answerCorrect = tweetnacl.sign.detached.verify(
    encoder.encode(challenge),
    Buffer.from(signature.data),
    publicKeyBytes,
  );
  console.log(
    `Verification result using challenge ${challenge}, public key ${JSON.stringify(
      publicKey,
    )}, challenge answer ${JSON.stringify(challengeAnswer)}: ${
      event.response.answerCorrect
    }`,
  );
  return event;
};
