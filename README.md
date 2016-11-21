# Vectorizer
Raster to Vector image converter written in JS
## Usage 
#### Include Script
```
<script src='app.js'></script>
```
#### Initialize an object and call makeVector 

```
var obj = new Vectorizer();
obj.makeVector(url, obj.SVGToContainer);

```
Appends the vectorized image to the root container (you can specify container to append to).

**Note:** The image URL **must** be in the same domain as the script. This is an SVG requirement in order to not to taint the canvas with foreign data.

## Options

Set **colorquantcycles = 1** for deterministic output. Any value > 1 produces non-deterministic output. Default used is 3

The **numberofcolors** option specifies palette color count. Cubic numbers ( 2^x) are suggested for deterministic palettes. Or, you can use a custom palette altogether

It is highly recommend **against**  altering lower linear threshold and quadratic spline values. They seem to be at an empirically OK place as they are. Change them if you want to experiment. Do **not** set their value > 2; inaccuracies are observed

The **mincolorratio** option is a threshold below which anomaly and outlier pixel colors are randomized to a palette color. For an image of size 20 x 20 , a 0.01 threshold randomizes any color whose count is less than 20 x 20 x 0.01 = 4 pixels 


## More Usage Options

``` 
var obj = new Vectorizer();
```
#### Alert the SVG string 
```
obj.makeVector(url,alert)
```

#### Append to a custom container
```
obj.makeVector(url, function(str){
   obj.SVGToContainer(str, 'Container-id-here');
});
