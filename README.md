# Vectorizer
Raster to Vector image converter written in JS

###Simplest usage 
```
var obj = new Vectorizer();
makeVector(url, obj.SVGToContainer);

```
 Appends the vectorized image to the root container (you can specify container to append to)
 The image URL **must** be in the same domain as the script. This is an SVG requirement in order to not to taint the canvas with foreign data
