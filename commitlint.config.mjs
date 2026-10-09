export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'type-enum': [2, 'always', ['feat','fix','docs','style','refactor','test','chore','ci','perf','revert','build','wip']],
    'subject-case': [2, 'never', ['start-case','pascal-case','upper-case']],
  },
}
