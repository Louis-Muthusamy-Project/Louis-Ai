import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'antd';
import { PictureOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import styles from './chatMessageBubble.module.css';

// Honest, rotating status text - these are stages of the real request
// lifecycle (request sent -> waiting on the provider -> still waiting),
// not a fabricated progress percentage. No backend progress events exist
// for image generation, so we never show a number.
const LOADING_STAGES = ['Creating your image...', 'Still working on it...', 'Almost there...'];

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

function ImageGenerationCard({ prompt }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    // Advances the honest status line over time. Not tied to any real
    // backend progress signal - it never implies a percentage or a
    // guaranteed completion time, just that the request is still in
    // flight. Stops advancing at the last stage rather than looping,
    // so it doesn't look like it's stuck restarting.
    if (stageIndex >= LOADING_STAGES.length - 1) return undefined;
    const timer = setTimeout(() => setStageIndex((i) => i + 1), 6000);
    return () => clearTimeout(timer);
  }, [stageIndex]);

  return (
    <div className={styles.imageGenCard}>
      <div className={styles.imageGenShimmer}>
        <PictureOutlined className={styles.imageGenIcon} />
      </div>
      <div className={styles.imageGenLabel}>{LOADING_STAGES[stageIndex]}</div>
      {prompt && <div className={styles.imageGenPrompt}>{prompt}</div>}
      <div className={styles.imageGenProvider}>Gemini Image</div>
    </div>
  );
}

function ImagePayload({ message }) {
  const image = message.image;
  const updateMessage = useChatStore(state => state.updateMessage);

  if (!image) return null;

  if (image.status === 'loading') {
    return <ImageGenerationCard prompt={image.prompt} />;
  }

  if (image.status === 'error') {
    return (
      <div className={styles.imageError}>
        <span>{image.error || 'Image generation failed.'}</span>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          // image.retrying guards against a double-click firing two
          // generation requests for the same message before the first
          // "loading" state has even rendered.
          disabled={image.retrying}
          onClick={() => {
            if (image.retrying) return;
            updateMessage(message.id, { image: { ...image, status: 'loading', error: null, retrying: true } });
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