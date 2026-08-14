/**
 * form layout
 */

export const formItemLayout = {
  labelCol: {
    xs: { span: 24 },
    sm: { span: 8 }
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 16 }
  }
}

export const tailFormItemLayout = {
  wrapperCol: {
    xs: {
      span: 24,
      offset: 0
    },
    sm: {
      span: 14,
      offset: 8
    }
  }
}

// Vertical (label-above-input) variants, used only by the bookmark form.
// Kept separate from formItemLayout/tailFormItemLayout above so other forms
// (widget-form, rdp/vnc connect dialogs) keep their horizontal layout.
export const verticalFormItemLayout = {}

export const verticalTailFormItemLayout = {
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 24 }
  }
}
