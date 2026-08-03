<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { githubWorkflowSchema } from '../schema/github-workflow-schema'
import IconDark from './icons/IconDark.vue'
import IconLight from './icons/IconLight.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    fileName?: string
    readOnly?: boolean
  }>(),
  {
    fileName: '.github/workflows/ci.yml',
    readOnly: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  validate: [markers: monaco.editor.IMarker[]]
}>()

const editorHost = ref<HTMLDivElement | null>(null)
const completionProvider = shallowRef<monaco.IDisposable | null>(null)
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
const monacoYaml = shallowRef<monaco.IDisposable | null>(null)
const markerListener = shallowRef<monaco.IDisposable | null>(null)
const isDark = ref(true)
const problemCount = ref(0)
const cursorPosition = ref({ line: 1, column: 1 })

const modelUri = monaco.Uri.parse('file:///current-workflow.yml')

const statusTone = computed(() => {
  if (problemCount.value === 0) return 'ok'
  return 'err'
})

function registerGithubActionsCompletions() {
  const rootKeys = [
    'name',
    'run-name',
    'on',
    'env',
    'defaults',
    'permissions',
    'concurrency',
    'jobs',
  ]
  const eventKeys = ['push', 'pull_request', 'workflow_dispatch', 'schedule', 'release']
  const jobKeys = ['name', 'runs-on', 'needs', 'if', 'permissions', 'env', 'strategy', 'steps']
  const stepKeys = ['name', 'id', 'if', 'uses', 'run', 'shell', 'with', 'env', 'working-directory']
  const runners = [
    'ubuntu-latest',
    'ubuntu-24.04',
    'ubuntu-22.04',
    'windows-latest',
    'macos-latest',
  ]
  const actions = ['actions/checkout@v4', 'actions/setup-node@v4', 'actions/cache@v4']

  function suggestions(values: string[], range: monaco.IRange, suffix = ': ') {
    return values.map((value) => ({
      label: value,
      kind: monaco.languages.CompletionItemKind.Property,
      insertText: `${value}${suffix}`,
      range,
    }))
  }

  return monaco.languages.registerCompletionItemProvider('yaml', {
    triggerCharacters: [' ', ':', '-'],
    provideCompletionItems(model, position) {
      const line = model.getLineContent(position.lineNumber)
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn,
      )

      const indent = line.match(/^\s*/)?.[0].length ?? 0

      if (/runs-on:\s*$/.test(line)) {
        return { suggestions: suggestions(runners, range, '') }
      }

      if (/uses:\s*$/.test(line)) {
        return { suggestions: suggestions(actions, range, '') }
      }

      if (/^\s*-\s*$/.test(line)) {
        return { suggestions: suggestions(stepKeys, range) }
      }

      if (indent === 0) {
        return { suggestions: suggestions(rootKeys, range) }
      }

      if (indent === 2) {
        return { suggestions: suggestions(eventKeys, range) }
      }

      if (indent === 4) {
        return { suggestions: suggestions(jobKeys, range) }
      }

      return { suggestions: suggestions(stepKeys, range) }
    },
  })
}

onMounted(() => {
  if (!editorHost.value) return

  monacoYaml.value = configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    hover: true,
    completion: true,
    validate: true,
    format: { singleQuote: false },
    schemas: [
      {
        uri: 'inmemory://schemas/github-workflow.json',
        fileMatch: ['**/current-workflow.yml'],
        schema: githubWorkflowSchema,
      },
    ],
  }) as unknown as monaco.IDisposable

  completionProvider.value = registerGithubActionsCompletions()

  const model = monaco.editor.getModel(modelUri) ?? monaco.editor.createModel('', 'yaml', modelUri)

  model.setValue(props.modelValue)

  const instance = monaco.editor.create(editorHost.value, {
    model,
    theme: isDark.value ? 'vs-dark' : 'vs',
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13.5,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontLigatures: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    padding: { top: 16, bottom: 16 },
    autoIndent: 'full',
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    formatOnType: true,
    formatOnPaste: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'smart',
    tabCompletion: 'on',
    wordBasedSuggestions: 'off',
    suggest: {
      showKeywords: true,
      showSnippets: true,
      preview: true,
    },
    bracketPairColorization: { enabled: true },
    guides: { indentation: true, bracketPairs: false },
  })

  editor.value = instance

  instance.onDidChangeModelContent(() => {
    emit('update:modelValue', instance.getValue())
  })

  instance.onDidChangeCursorPosition((e) => {
    cursorPosition.value = { line: e.position.lineNumber, column: e.position.column }
  })

  markerListener.value = monaco.editor.onDidChangeMarkers((uris) => {
    if (!uris.some((uri) => uri.toString() === modelUri.toString())) return

    const markers = monaco.editor.getModelMarkers({ resource: modelUri })

    problemCount.value = markers.filter(
      (marker) =>
        marker.severity === monaco.MarkerSeverity.Error ||
        marker.severity === monaco.MarkerSeverity.Warning,
    ).length

    emit('validate', markers)
  })
})

watch(
  () => props.modelValue,
  (next) => {
    const instance = editor.value
    if (!instance) return
    if (instance.getValue() !== next) {
      instance.executeEdits('external-update', [
        {
          range: instance.getModel()!.getFullModelRange(),
          text: next,
        },
      ])
    }
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    editor.value?.updateOptions({ readOnly })
  },
)

watch(isDark, (dark) => {
  monaco.editor.setTheme(dark ? 'vs-dark' : 'vs')
})

function formatDocument() {
  editor.value?.getAction('editor.action.formatDocument')?.run()
}

function triggerSuggest() {
  editor.value?.focus()
  editor.value?.trigger('toolbar', 'editor.action.triggerSuggest', {})
}

defineExpose({ formatDocument, triggerSuggest })

onBeforeUnmount(() => {
  completionProvider.value?.dispose()
  markerListener.value?.dispose()
  editor.value?.dispose()
  monacoYaml.value?.dispose()
  monaco.editor.getModel(modelUri)?.dispose()
})
</script>

<template>
  <div class="flex flex-col overflow-hidden rounded-lg border border-line">
    <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <div class="flex min-w-0 items-center gap-2">
        <span class="flex gap-1.5" aria-hidden="true">
          <span class="h-2.5 w-2.5 rounded-full bg-err/70" />
          <span class="h-2.5 w-2.5 rounded-full bg-warn/70" />
          <span class="h-2.5 w-2.5 rounded-full bg-ok/70" />
        </span>
        <span class="truncate font-mono text-xs text-slate-300">{{ fileName }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span
          class="hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium sm:flex"
          :class="
            statusTone === 'ok'
              ? 'border-ok/30 bg-ok/10 text-ok'
              : 'border-err/30 bg-err/10 text-err'
          "
        >
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="statusTone === 'ok' ? 'bg-ok' : 'bg-err'"
          />
          {{
            statusTone === 'ok'
              ? 'Schema valid'
              : `${problemCount} problem${problemCount === 1 ? '' : 's'}`
          }}
        </span>

        <button type="button" @click="isDark = !isDark">
          <component :is="isDark ? IconLight : IconDark" />
        </button>
      </div>
    </div>

    <div ref="editorHost" class="h-[520px] w-full" />

    <div
      class="flex items-center justify-between border-t border-line bg-canvas-subtle px-4 py-1.5 font-mono text-[11px] text-slate-400"
    >
      <span>YAML · GitHub Actions schema</span>
      <span>Ln {{ cursorPosition.line }}, Col {{ cursorPosition.column }}</span>
    </div>
  </div>
</template>
