# custom insertion example

This example shows how you can define the position where the scripts are injected
by setting `inject:false` and using the template parameters inside the `index.ejs`

The example is using the template parameters `headTags` and `bodyTags`

```
<%= htmlWebpackPlugin.tags.headTags %>
<%= htmlWebpackPlugin.tags.bodyTags %>
```

`headTags` and `bodyTags` are arrays so you can use any Array.prototype function like `filter`:

```
<%= htmlWebpackPlugin
  .tags
  .headTags
  .filter((tag) => tag.tagName === 'meta')
  .join('') 
%>
```

For further information about the tag object take a look at the `createHtmlTagObject` inside `lib/html-tags.js` or at the `prepareAssetTagGroupForRendering` inside `index.js`.
