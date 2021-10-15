import React from 'react';
import { Layout } from 'antd';

import { LABELS } from '../../constants';
import { AppBar } from '../AppBar';
import useWindowDimensions from '../../utils/layout';
import { useProfile } from '../../contexts';

const { Header, Content } = Layout;

const paddingForLayout = (width: number) => {
  if (width <= 768) return '5px 10px';
  if (width > 768) return '10px 30px';
};

export const AppLayout = React.memo((props: any) => {
  const { width } = useWindowDimensions();
  const { creator, hasLoaded: hasCreatorLoaded } = useProfile();

  return (
    <>
      <Layout
        title={LABELS.APP_TITLE}
        style={{
          padding: paddingForLayout(width),
          maxWidth: 1000,
          width: "100%"
        }}
      >
        <Header className="App-Bar">
          <AppBar creator={creator} hasCreatorLoaded={hasCreatorLoaded}/>
        </Header>
        <Content style={{ overflow: 'scroll', paddingBottom: 50 }}>
          {props.children}
        </Content>
      </Layout>
    </>
  );
});
