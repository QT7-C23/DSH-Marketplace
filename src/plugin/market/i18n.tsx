import React, { createContext, useContext } from 'react';
import { translate, translateMessage } from '../../languages/index.mjs';
export const LanguageContext = createContext('zh-CN');
export function useLanguage() {
  const language = useContext(LanguageContext);
  return { language, t: (key: string, values: Record<string, string | number> = {}) => translate(language, key, values), text: (message: string) => translateMessage(language, message) };
}
export const typeKey = (type: string) => type === '插件' ? 'typePlugin' : type === '主题' ? 'typeTheme' : `type${type}`;
