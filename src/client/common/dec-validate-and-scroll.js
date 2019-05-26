/**
 * validateFieldsAndScroll decorator
 * @param {class} target
 */
export function validateFieldsAndScroll (target) {
  target.prototype.validateFieldsAndScroll = function () {
    let { validateFieldsAndScroll } = this.props.form
    return new Promise(resolve => {
      validateFieldsAndScroll((errors, values) => {
        if (errors) resolve(false)
        else resolve(values)
      })
    })
  }
}
