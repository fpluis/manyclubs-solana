import { UploadOutlined } from '@ant-design/icons';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Layout,
  Col,
  Spin,
  Row,
  Form,
  Button,
  Input,
  Upload,
  message,
} from 'antd';
import { useProfile, useRemoteStorage } from '../../contexts';
import React, { useMemo, useState } from 'react';

const profilePictureUpload = event => {
  console.log('Upload event:', event);

  if (Array.isArray(event)) {
    return event;
  }

  return event && event.profilePictureUpload;
};

const getBase64 = (img, callback) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.readAsDataURL(img);
};

// Reworked from https://codepen.io/pen/?editors=0010
const AvatarUpload = ({
  initialImage,
  customRequest,
  maxSizeInMB,
  listType = 'picture',
}: {
  initialImage?: string;
  customRequest: any;
  maxSizeInMB?: number;
  listType?: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(initialImage || '');

  const beforeUpload = file => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      message.error('Please, upload eithera  JPG or a PNG image.');
      return false;
    }

    if (maxSizeInMB && file.size / 1024 / 1024 > maxSizeInMB) {
      message.error(
        `The image is too large, please use an image smaller than ${maxSizeInMB}MB.`,
      );
      return false;
    }

    return true;
  };

  const handleChange = info => {
    if (info.file.status === 'uploading') {
      setIsLoading(true);
      return;
    }
    if (info.file.status === 'done') {
      // Get this url from response in real world.
      getBase64(info.file.originFileObj, imageUrl => {
        setIsLoading(false);
        setImageUrl(imageUrl);
      });
    }
  };

  // const uploadButton = isLoading ? (
  //   <LoadingOutlined />
  // ) : (
  //   <div style={{ cursor: 'pointer' }}>
  //     <p className="ant-upload-drag-icon" style={{ fontSize: '48px' }}>
  //       <PlusOutlined />
  //     </p>
  //   </div>
  // );

  return (
    <Upload
      listType={listType || ('picture' as any)}
      className="avatar-uploader"
      showUploadList={false}
      beforeUpload={beforeUpload}
      onChange={handleChange}
      customRequest={customRequest}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="avatar"
          style={{ width: '100%', cursor: 'pointer' }}
        />
      ) : (
        <Button icon={<UploadOutlined />}>Click to Upload</Button>
      )}
    </Upload>
  );
};

export const ProfileView = () => {
  const wallet = useWallet();
  const address = wallet.publicKey?.toBase58();
  const { creator, hasLoaded: hasCreatorLoaded, setCreator } = useProfile();
  const [props, setProps] = useState({});

  useMemo(() => {
    if (hasCreatorLoaded) {
      setProps(creator);
    }
  }, [hasCreatorLoaded]);

  const { remoteStorage } = useRemoteStorage();
  console.log(`Showing profile of creator ${JSON.stringify(creator)}`);
  return hasCreatorLoaded ? (
    <Col span={24}>
      <Row style={{ margin: '0 30px', textAlign: 'left', fontSize: '1.4rem' }}>
        <Col span={24} style={{ margin: '0 auto' }}>
          <Form
            initialValues={{
              description: creator.description,
              username: creator.username,
            }}
            style={{ marginTop: 64 }}
            name="validate_other"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 14 }}
            onFinish={async formProps => {
              console.log(`Props: ${JSON.stringify(props)}`);
              const updatedCreator = {
                ...props,
                ...formProps,
                address,
              };
              await remoteStorage.putCreator(updatedCreator);
              setCreator(updatedCreator);
              message.success('Profile updated successfully!');
            }}
          >
            <Form.Item label="Banner">
              <AvatarUpload
                initialImage={creator.banner}
                customRequest={async args => {
                  const url = await remoteStorage.uploadPublicFile(
                    address,
                    args,
                    'banner',
                  );
                  setProps({ ...props, banner: url });
                }}
              />
            </Form.Item>
            <Form.Item label="Profile Picture">
              <Form.Item
                valuePropName="profilePicture"
                getValueFromEvent={profilePictureUpload}
                noStyle
              >
                <AvatarUpload
                  initialImage={creator.image}
                  customRequest={async args => {
                    const url = await remoteStorage.uploadPublicFile(
                      address,
                      args,
                      'avatar',
                    );
                    setProps({ ...props, image: url });
                  }}
                  maxSizeInMB={4}
                  listType="picture-card"
                />
              </Form.Item>
            </Form.Item>
            <Form.Item name="username" label="Username">
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={16} />
            </Form.Item>

            <Form.Item
              wrapperCol={{
                span: 12,
                offset: 6,
              }}
            >
              <Button type="primary" htmlType="submit">
                Submit
              </Button>
            </Form.Item>
          </Form>
          <Button
            style={{ backgroundColor: '#d50000' }}
            onClick={async () => {
              await remoteStorage.logOut();
              setCreator({
                username: '',
                address: '',
                description: '',
                banner: '',
                image: '',
              });
              message.success('Logged out. Redirecting to homepage.');
              setTimeout(() => {
                window.location.replace(new URL(document.URL).origin);
              }, 1000);
            }}
          >
            Log out
          </Button>
        </Col>
      </Row>
    </Col>
  ) : (
    <Spin></Spin>
  );
};
