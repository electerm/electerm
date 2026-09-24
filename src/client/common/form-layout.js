/**
 * form layout
 */

export const formItemLayout = {
  // 用户要求的布局调整：标签左对齐 + 收窄标签列（原 sm span 8 + 默认右对齐
  // 会在行首留出约 1/3 宽度的空白，与子页签行不对齐）
  labelAlign: 'left',
  labelCol: {
    xs: { span: 24 },
    sm: { span: 6 }
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 18 }
  }
}

export const tailFormItemLayout = {
  wrapperCol: {
    xs: {
      span: 24,
      offset: 0
    },
    sm: {
      span: 24,
      offset: 0
    }
  }
}
