/**
 * Common bookmark category select component that automatically updates color when category changes
 */

import { useEffect } from 'react'
import { TreeSelect, Form } from 'antd'
import formatBookmarkGroups from './bookmark-group-tree-format'

const FormItem = Form.Item
const e = window.translate

export default function BookmarkCategorySelect ({
  bookmarkGroups = [],
  form,
  formItemLayout,
  name = 'category',
  onChange
}) {
  const tree = formatBookmarkGroups(bookmarkGroups)

  // Watch for category field changes using Form.useWatch
  const categoryId = Form.useWatch(name, form)

  // Find the selected category
  const findCategory = (groups, id) => {
    for (const group of groups) {
      if (group.id === id) {
        return group
      }
      if (group.bookmarkGroupTree && group.bookmarkGroupTree.length > 0) {
        const found = findCategory(group.bookmarkGroupTree, id)
        if (found) return found
      }
    }
    return null
  }

  // Watch for category field changes and update color accordingly
  useEffect(() => {
    if (categoryId) {
      const category = findCategory(bookmarkGroups, categoryId)
      if (category && category.color) {
        form.setFieldsValue({
          color: category.color
        })
      }
    }
  }, [categoryId, bookmarkGroups, form])

  const handleCategoryChange = (categoryId) => {
    const category = findCategory(bookmarkGroups, categoryId)

    // Only update the color field if the category has a color
    if (category && category.color) {
      form.setFieldsValue({
        color: category.color
      })
    }

    // Call the original onChange if provided
    if (onChange) {
      onChange(categoryId)
    }
  }

  return (
    <FormItem
      {...formItemLayout}
      label={e('bookmarkCategory')}
      name={name}
    >
      <TreeSelect
        treeData={tree}
        treeDefaultExpandAll
        showSearch
        onChange={handleCategoryChange}
      />
    </FormItem>
  )
}
