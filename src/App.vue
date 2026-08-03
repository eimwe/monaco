<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { ref } from 'vue'
import WorkflowYamlEditor from './components/WorkflowYamlEditor.vue'
import { sampleWorkflow } from './schema/sample-workflow'

const yaml = ref(sampleWorkflow)
const problemCount = ref(0)

function onValidate(markers: monaco.editor.IMarker[]) {
  problemCount.value = markers.filter(
    (marker) =>
      marker.severity === monaco.MarkerSeverity.Error ||
      marker.severity === monaco.MarkerSeverity.Warning,
  ).length
}
</script>

<template>
  <div class="min-h-screen">
    <div class="mx-auto max-w-6xl px-6 py-12">
      <div class="min-w-0">
        <WorkflowYamlEditor v-model="yaml" @validate="onValidate" />
      </div>
    </div>
  </div>
</template>
