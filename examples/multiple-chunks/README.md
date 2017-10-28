# Multiple HTML files & multiple entry-point example

This example demonstrates how html-webpack-plugin may be used to build a project
that has multiple HTML files, each of which utilizes a unique entry point.

This configuration builds one chunk (.js file) per entry point, and utilizes
the [CommonsChunkPlugin](https://webpack.js.org/plugins/commons-chunk-plugin/)
to create a third chunk that contains any modules that shared by the two
entry-points.
