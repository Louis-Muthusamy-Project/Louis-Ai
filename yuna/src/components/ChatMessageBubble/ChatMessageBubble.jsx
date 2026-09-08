import React from 'react';
import { motion } from 'framer-motion';
import { Spin, Button } from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import styles from './chatMessageBubble.module.css';

import SocketService from '../../services/socketService';
import useChatStore from '../../store/chatStore';

function downloadGeneratedImage(image) {
  const mimeType = image.mimeType || 'image/png';
  const extension = mimeType.split('/')[1] || 'png';
  const slug = (image.prompt || 'yuna-image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'yuna-image';

  const link = document.createElement('a');
  link.href = `data:${mimeType};base64,${image.data}`;
  link.download = `${slug}-${Date.now()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ImagePayload({ message }) {
  const image = message.image;
  const updateMessage = useChatStore(state => state.updateMessage);

  if (!image) return null;

  if (image.status === 'loading') {
    return (
      <div className={styles.imageLoading}>
        <Spin size="small" />
        <span>Generating image...</span>
      </div>
    );
  }

  if (image.status === 'error') {
    return (
      <div className={styles.imageError}>
        <span>{image.error || 'Image generation failed.'}</span>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => {
            updateMessage(message.id, { image: { ...image, status: 'loading', error: null } });
            SocketService.emit('IMAGE_GENERATE', { prompt: image.prompt });
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  // status === 'done'
  return (
    <div className={styles.generatedImageWrap}>
      <img
        className={styles.generatedImage}
        src={`data:${image.mimeType};base64,${image.data}`}
        alt={image.prompt || 'Generated image'}
      />
      <Button
        size="small"
        icon={<DownloadOutlined />}
        className={styles.imageDownloadButton}
        onClick={() => downloadGeneratedImage(image)}
      >
        Download
      </Button>
    </div>
  );
}

function ChatMessageBubble({ message }) {
  const role = message?.role || 'assistant';
  const text = message?.text || '';

  const isUser = role === 'user';

  return (
    <motion.div
      className={isUser ? styles.rowUser : styles.rowAssistant}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.22 }}
    >
      <div className={isUser ? styles.bubbleUser : styles.bubbleAssistant}>
        {text && <div className={styles.text}>{text}</div>}
        <ImagePayload message={message} />
      </div>
    </motion.div>
  );
}

export default React.memo(ChatMessageBubble);