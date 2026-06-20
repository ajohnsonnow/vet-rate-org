export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [['/color/', 'fill', 'stroke', 'background-color', 'border-color'], {ignoreValues: ['transparent','inherit','currentColor','none','initial','unset']}],
    'unit-allowed-list': ['rem','em','%','px','vw','vh','svh','svw','dvh','dvw','fr','deg','ms','s','ch','ex','vmin','vmax','cqi','cqb','cqw','cqh'],
    'color-no-invalid-hex': true,
    'font-family-no-missing-generic-family-keyword': true,
  },
  ignoreFiles: ['dist/**','node_modules/**','coverage/**'],
}
