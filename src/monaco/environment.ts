import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import YamlWorker from './yaml.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: import('monaco-editor').Environment
  }
}

self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'yaml') {
      return new YamlWorker()
    }
    return new EditorWorker()
  },
}
