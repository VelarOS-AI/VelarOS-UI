/**
 * HTML 源码视图与着色分词器，供 Widget 查看源码以及独立子入口消费。
 * 根门面的消息与 Widget 组件也静态引用它，不承诺模块级延迟加载。
 */
export * from './htmlArtifactCodeTokenizer'
export * from './HtmlArtifactSourceCode'
