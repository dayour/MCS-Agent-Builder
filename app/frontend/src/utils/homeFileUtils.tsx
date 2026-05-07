import React from 'react';
import {
  DocumentPdf16Regular,
  DocumentText16Regular,
  Table16Regular,
  SlideText16Regular,
  Image16Regular,
  CodeBlock16Regular,
  Attach16Regular,
} from '@fluentui/react-icons';
import { callModel } from './modelClient';

export const getFileIcon = (file: File): React.ReactNode => {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const iconClass = "text-gray-500";
  if (['pdf'].includes(ext)) return <DocumentPdf16Regular className={iconClass} />;
  if (['doc', 'docx', 'txt', 'md'].includes(ext)) return <DocumentText16Regular className={iconClass} />;
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return <Table16Regular className={iconClass} />;
  if (['ppt', 'pptx'].includes(ext)) return <SlideText16Regular className={iconClass} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <Image16Regular className={iconClass} />;
  if (['json', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'html', 'css'].includes(ext)) return <CodeBlock16Regular className={iconClass} />;
  return <Attach16Regular className={iconClass} />;
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text.length > 15000 ? text.substring(0, 15000) + '\n\n[...truncated]' : text);
    };
    reader.onerror = () => resolve('[Could not read file]');
    reader.readAsText(file);
  });
};

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Strip the data:image/xxx;base64, prefix to get raw base64
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

export const describeImageWithVision = async (file: File, base64Data: string): Promise<string> => {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mediaType = ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    const text = await callModel({
      model: 'balanced',
      maxTokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: `Describe this image in detail. It was uploaded as a reference document for building a software solution. Extract ALL useful information: process steps, stages, roles, decision points, data flows, labels, terminology, relationships, and any other details that would help understand the user's current process or system. Be thorough and specific — this description will be used as context for building their solution.`,
          },
        ],
      }],
    });

    return text.trim() || `[Image: ${file.name}]`;
  } catch (error) {
    console.error('Error describing image with vision:', error);
    return `[Image file: ${file.name} — could not parse contents]`;
  }
};
