/**
 * WXT 与扩展环境类型辅助声明
 */

declare function defineBackground(cb: () => void): { main: () => void };

declare function defineContentScript(options: {
  matches: string[];
  cssInjectionMode?: string;
  main: () => void;
}): { matches: string[]; main: () => void };

declare module '*.css' {
  const content: string;
  export default content;
}
