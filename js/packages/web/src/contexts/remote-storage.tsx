import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Amplify from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import API from '@aws-amplify/api';

const DEFAULT_PASSWORD = 'Ab_12345';

const CDN_URL = 'https://cdn.keyther.com';
const API_URL = 'https://api.keyther.com';

// https://stackoverflow.com/questions/190852/how-can-i-get-file-extensions-with-javascript
const getExtension = filename =>
  /[.]/.exec(filename) ? /[^.]+$/.exec(filename) : undefined;

const byCreationDateAscending = (
  { creationDate: creationDate1 }: any,
  { creationDate: creationDate2 }: any,
) => new Date(creationDate2).getTime() - new Date(creationDate1).getTime();

export class RemoteStorage {
  creators: any[];

  constructor() {
    this.creators = [];
    Amplify.configure({
      Auth: {
        region: 'us-east-1',
        userPoolId: 'us-east-1_LAkWv0TwJ',
        userPoolWebClientId: '5o53m9rf73tihadjk6j3af68eo',
        authenticationFlowType: 'CUSTOM_AUTH',

        // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
        mandatorySignIn: true,
        identityPoolId: 'us-east-1:50f3de0c-ecd1-4c6b-94c9-18a06752a2da',
      },
      Analytics: {
        disabled: true,
      },
      API: {
        endpoints: [
          {
            name: 'api',
            endpoint: API_URL,
            custom_header: async () => ({
              Authorization: `${(await Auth.currentSession())
                .getIdToken()
                .getJwtToken()}`,
            }),
          },
          {
            name: 'cdn',
            endpoint: CDN_URL,
            custom_header: async () => ({
              Authorization: `${(await Auth.currentSession())
                .getAccessToken()
                .getJwtToken()}`,
            }),
          },
        ],
      },
    });
  }

  async getCreators() {
    if (this.creators.length > 0) {
      return this.creators;
    }

    let creators = [];
    try {
      creators = await API.get('api', `/creators`, {
        Authorization: `${(await Auth.currentSession())
          .getIdToken()
          .getJwtToken()}`,
      });
      this.creators = creators;
      console.log(`Creators: ${JSON.stringify(creators)}`);
    } catch (error) {
      console.log(`Error getting creator:`, error);
    }

    return creators;
  }

  async getCreator(address: string) {
    console.log(
      `Looking for creator ${address} in ${JSON.stringify(this.creators)}`,
    );
    const cached = this.creators.find(
      ({ address: otherAddress }) => address === otherAddress,
    );
    if (cached != null) {
      return cached;
    }

    const creator = await API.get('api', `/creators/${address}`, {
      Authorization: `${(await Auth.currentSession())
        .getIdToken()
        .getJwtToken()}`,
    });
    // this.creators = [...this.creators, creator];
    return creator;
  }

  async putCreator(props: {
    address: string;
    username: string;
    description: string;
    image?: string;
    banner?: string;
  }) {
    console.log(`Putting creator with props ${JSON.stringify(props)}`);
    const { address, description, username, image, banner } = props;
    return API.put('api', `/creators/${address}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${(await Auth.currentSession())
          .getIdToken()
          .getJwtToken()}`,
      },
      body: { address, description, username, image, banner },
    });
  }

  addExternalProps = async ({ author: address, filePaths = [], ...props }) => {
    const creator = await this.getCreator(address);
    console.log(
      `Creator associated to address ${address}: ${JSON.stringify(creator)}`,
    );
    const files = await Promise.all(filePaths.map(url => this.getFile(url)));
    // console.log(
    //   `Creator for address ${address}: ${JSON.stringify(creator)};`,
    // );
    return {
      ...props,
      creator,
      filePaths,
      files,
    };
  };

  async getPosts(community: string = '', retries = 0) {
    let posts: any[] = [];
    try {
      posts = await API.get('api', `/posts/${community}`, {
        Authorization: `${(await Auth.currentSession())
          .getIdToken()
          .getJwtToken()}`,
      });
    } catch (error) {
      console.log(`Error getting posts from ${community}: ${error}`);
      return retries < 5 ? this.getPosts(community, retries + 1) : [];
    }

    // console.log(`Posts for art ${id}: ${JSON.stringify(posts)}`);
    const withExternalProps = await Promise.all(
      posts.map(this.addExternalProps),
    );
    console.log(
      `Posts with external props: ${JSON.stringify(withExternalProps)}`,
    );
    return withExternalProps.sort(byCreationDateAscending);
  }

  getCreatorPosts(communityAddresses: string[]) {
    console.log(`Get posts from these communities: ${communityAddresses}`);
    return Promise.all(
      communityAddresses.map(async address =>
        API.get('api', `/posts/${address}`, {
          Authorization: `${(await Auth.currentSession())
            .getIdToken()
            .getJwtToken()}`,
        })
          .then(posts => Promise.all(posts.map(this.addExternalProps)))
          .catch(error => {
            console.log(`Error getting posts from ${address}: ${error}`);
            return [];
          }),
      ),
    ).then(postsByCommunity =>
      postsByCommunity
        .reduce(
          (flat, communityPosts) => [...flat, ...communityPosts],
          [] as any[],
        )
        .sort(byCreationDateAscending),
    );
  }

  async uploadPublicFile(address, { file, onError, onSuccess }: any, type) {
    console.log(`Uploading public file with name ${file.name}`);
    console.log(file);
    const { name: fileName } = file as File;

    const session = await Auth.currentSession();
    const jwt = session.getAccessToken().getJwtToken();
    const url = `${CDN_URL}/${type}/${address}.${getExtension(fileName)}`;
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url, true);
      request.setRequestHeader('Authorization', jwt);
      request.onload = event => {
        console.log(`Uploaded`);
        console.log(event);
        resolve(event);
      };
      request.onerror = error => {
        reject(error);
      };
      request.send(file);
    })
      .then(result => {
        console.log(`Put result of url '${url}':`);
        console.log(result);
        onSuccess(result);
        return url;
      })
      .catch(error => {
        console.log(
          `Error uploading public file to ${CDN_URL}/${address}.${getExtension(
            fileName,
          )}`,
        );
        console.log(error);
        onError(error);
        return null;
      });
  }

  createPost(community: string, authorPubkey: string) {
    return async ({ title, content, visibility, dragger = [] }: any) => {
      const filePaths = dragger
        .filter(({ status }) => status === 'done')
        .map(({ name }) => `${CDN_URL}/${community}/${name}`);
      const body = { title, content, visibility, filePaths };
      return API.put('api', `/posts/${community}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${(await Auth.currentSession())
            .getIdToken()
            .getJwtToken()}`,
        },
        body,
      }).then(() =>
        this.addExternalProps({
          ...body,
          author: authorPubkey,
          creationDate: new Date().toISOString(),
        }),
      );
    };
  }

  async getFile(url: string, retries = 0, maxRetries = 4) {
    const { pathname } = new URL(url);
    console.log();
    return (
      API.get('cdn', pathname, {
        responseType: 'blob',
      })
        // .then(file => URL.createObjectURL(file))
        .catch(error => {
          console.log(`Error getting file at ${pathname}: ${error}`);
          if (retries < maxRetries) {
            return this.getFile(url, retries + 1, maxRetries);
          }
        })
    );
  }

  uploadFile(community: string) {
    return async ({ file, onError, onSuccess }: any) => {
      console.log(`Uploading file to ${community} with name ${file.name}`);
      console.log(file);
      const { name: fileName } = file as File;
      const session = await Auth.currentSession();
      const jwt = session.getAccessToken().getJwtToken();
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', `${CDN_URL}/${community}/${fileName}`, true);
        request.setRequestHeader('Authorization', jwt);
        request.onload = event => {
          console.log(`Uploaded`);
          console.log(event);
          resolve(event);
        };
        request.onerror = error => {
          reject(error);
        };
        request.send(file);
      })
        .then(result => {
          console.log(`Put result:`);
          console.log(result);
          onSuccess(result);
        })
        .catch(error => {
          console.log(
            `Error uploading file to ${community} with name ${fileName}`,
          );
          console.log(error);
          onError(error);
        });
    };
  }

  async logOut() {
    try {
      await Auth.signOut();
    } catch (error) {
      console.log('error signing out: ', error);
    }
  }
}

type RemoteStorageConfig = {
  remoteStorage: RemoteStorage;
  isReady: Boolean;
};

const RemoteStorageContext = React.createContext<RemoteStorageConfig>({
  remoteStorage: new RemoteStorage(),
  isReady: false,
});

export const RemoteStorageProvider = ({ children = null as any }) => {
  const { connected, publicKey } = useWallet();

  const remoteStorage = useMemo(() => new RemoteStorage(), []);
  const [isReady, setIsReady] = useState<Boolean>(false);

  useEffect(() => {
    const customAuthFlow = async user => {
      console.log(
        `Following custom auth flow; challenge parameters: ${JSON.stringify(
          user,
        )}`,
      );
      const {
        challengeName,
        challengeParam: { challenge },
      } = user;
      if (challengeName === 'CUSTOM_CHALLENGE') {
        const encodedMessage = new TextEncoder().encode(challenge);
        const challengeAnswer = await window['solana'].signMessage(
          encodedMessage,
          'utf8',
        );
        console.log(
          `Challenge: ${challenge}; encoded message ${JSON.stringify(
            encodedMessage,
          )} answer ${JSON.stringify(challengeAnswer)}`,
        );
        Auth.sendCustomChallengeAnswer(
          user,
          JSON.stringify(challengeAnswer.signature),
        )
          .then(async user => {
            setIsReady(true);
            console.log(`Remote storage ready`);
            const session = await Auth.currentSession();
            const jwt = session.getIdToken().getJwtToken();
            console.log(`JWT: ${jwt}`);
          })
          .catch(err => console.log(err));
      } else {
        console.log(`Challenge name is not custom; response:`);
        console.log(JSON.stringify(user));
      }
    };

    const logIntoCognito = async publicKeyString => {
      console.log(`Logging into cognito`);
      return Auth.signIn(publicKeyString)
        .then(customAuthFlow)
        .catch(error => {
          console.log(`Error signing in:`);
          console.log(error);
          if (error != null && error.code === 'UserNotFoundException') {
            Auth.signUp({
              username: publicKeyString,
              password: DEFAULT_PASSWORD,
            }).then(() => logIntoCognito(publicKeyString));
          }
        });
    };

    console.log(
      `Credentials provider; Connected? ${connected}; public key ${publicKey}`,
    );
    if (!(connected && publicKey)) {
      return;
    }

    Auth.currentSession()
      .then(session => {
        console.log(
          `User is signed-in, no need to do auth flow; JWT: ${session
            .getIdToken()
            .getJwtToken()}`,
        );
        setIsReady(true);
      })
      .catch(error => {
        console.log(
          `Error getting current authed user: ${JSON.stringify(error)}`,
        );
        logIntoCognito(publicKey.toString());
      });
  }, [connected, publicKey]);

  return (
    <RemoteStorageContext.Provider value={{ isReady, remoteStorage }}>
      {children}
    </RemoteStorageContext.Provider>
  );
};

export function useRemoteStorage() {
  return useContext(RemoteStorageContext);
}
