if ( WEBGL.isWebGLAvailable() === false ) {
    document.body.appendChild( WEBGL.getWebGLErrorMessage() );
}

var rendererSize = 700;
var aspectRatio = 1.6;

var objectView = {
    camera: null,
    scene: null,
    renderer: null,
    objects: [],
    orbitControls: null,
    transformControls: null,
    dragControls: null,
    Init: function() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( rendererSize, rendererSize/aspectRatio );
        document.getElementById("objects-view").appendChild( this.renderer.domElement );
        // camera
        this.camera = new THREE.PerspectiveCamera( 40, rendererSize / (rendererSize/aspectRatio), 1, 1000 );
        this.camera.position.set( 25, 30, 40 );
        this.scene.add( this.camera );
        // light
        this.scene.add( new THREE.AmbientLight( 0x222222 ) );
        var light = new THREE.PointLight( 0xffffff, 1 );
        this.camera.add( light );
        // helper
        var helper = new THREE.GridHelper( 2000, 100 );
        helper.material.opacity = 0.25;
        helper.material.transparent = true;
        this.scene.add( helper );
        
        this.AddObject(new THREE.Vector3(15, 9, 5), 0x6666ff);
        this.AddObject(new THREE.Vector3(10, 0, 3), 0x66ff66);

        this.InitControls();

        this.Render();
    },
    InitControls: function() {
        document.getElementById("object-view-veil").style.display = "none";
        this.orbitControls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
        this.orbitControls.minDistance = 20;
        this.orbitControls.maxDistance = 200;

        this.orbitControls.addEventListener("change", function () {
            objectView.Render();
        });

        this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener( 'dragging-changed', function ( event ) {
            objectView.orbitControls.enabled = ! event.value;
            objectView.Render();
        } );
        this.transformControls.addEventListener( 'objectChange', function () {
            var obj1 = objectView.transformControls.object;
            var obj2 = obj1.sibling;
            obj2.position.set(obj1.position.x, obj1.position.y, obj1.position.z);
            minkowskiView.GenerateMinkowskiDifference();
            objectView.Render();
        } );

        this.scene.add( this.transformControls );

        this.dragControls = new THREE.DragControls( this.objects, this.camera, this.renderer.domElement );
        this.dragControls.enabled = false;

        this.dragControls.addEventListener( 'hoveron', function ( event ) {
            if(!objectView.transformControls.dragging)
                objectView.transformControls.attach( event.object );
            objectView.Render();
        } );
        this.dragControls.addEventListener( 'hoveroff', function () {
            objectView.transformControls.detach();
            objectView.Render();
        } );
    },
    RemoveControls: function() {
        document.getElementById("object-view-veil").style.display = "block";
        this.orbitControls.dispose();
        this.transformControls.dispose();
        this.dragControls.dispose();
    },
    AddObject: function(position, color) {
        // textures
        var loader = new THREE.TextureLoader();
        var texture = loader.load( '/assets/textures/sprites/disc.png' );
        var group = new THREE.Group();
        this.scene.add( group );
        
        var meshMaterial = new THREE.MeshLambertMaterial( {
            color: color,
            opacity: 0.5,
            transparent: true
        } );

        var meshGeometry = new THREE.BoxGeometry( 10, 10, 10 );
        var backMesh = new THREE.Mesh( meshGeometry, meshMaterial );
        backMesh.material.side = THREE.BackSide; // back faces
        backMesh.renderOrder = 0;
        group.add( backMesh );

        var frontMesh = new THREE.Mesh( meshGeometry, meshMaterial.clone() );
        frontMesh.material.side = THREE.FrontSide; // front faces
        frontMesh.renderOrder = 1;
        group.add( frontMesh );

        frontMesh.sibling = backMesh;
        backMesh.sibling = frontMesh;

        backMesh.position.set(position.x, position.y, position.z);
        frontMesh.position.set(position.x, position.y, position.z);

        this.objects.push(frontMesh);
    },
    Render: function() {
        this.renderer.render( this.scene, this.camera );
    },
};
var minkowskiView = {
    camera: null,
    scene: null,
    points: null,
    renderer: null,
    showConvexHull: true,
    showConsole: true,
    simplexPoints: [],
    simplexObject: null,
    simplexDirectionObject: null,
    simplexDirectionObjectOrigin: null,
    textSprites: [],
    console: null,
    isSupportStep: true,
    isSimplexDone: false,
    nextPoint: null,
    UI: {
        instance: null,
        showSimplexConstructionOption: null,
        addConvexHullOption: null,
    },
    objects: [],
    Init: function() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( rendererSize, rendererSize/aspectRatio );
        document.getElementById("minkowski-view").appendChild( this.renderer.domElement );

        this.InitConsole();

        // camera
        this.camera = new THREE.PerspectiveCamera( 40, rendererSize / (rendererSize / aspectRatio), 1, 1000 );
        this.camera.position.set( 45, 50, 70 );
        this.scene.add( this.camera );
        // light
        this.scene.add( new THREE.AmbientLight( 0x222222 ) );
        var light = new THREE.PointLight( 0xffffff, 1 );
        this.camera.add( light );
        // helper
        var helper = new THREE.GridHelper( 2000, 100 );
        helper.material.opacity = 0.25;
        helper.material.transparent = true;
        this.scene.add( helper );
        
        this.GenerateMinkowskiDifference();
        this.ShowOrigin();

        this.InitControls();
        this.InitGUI();
        this.InitTextSprites();

        this.Render();
    },
    InitConsole: function() {
        this.console = document.getElementById("minkowski-console");
    },
    WriteToConsole: function(string) {
        var node = document.createElement("li");
        var textNode = document.createTextNode(string);
        node.appendChild(textNode);
        this.console.appendChild(node);
        this.console.scrollTop = this.console.scrollHeight;
    },
    InitControls: function() {
        var controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
        controls.minDistance = 20;
        controls.maxDistance = 200;

        controls.addEventListener("change", function () {
            minkowskiView.Render();
        });
    },
    ShowOrigin: function() {
        var geometry = new THREE.BufferGeometry();
        var originPoint = [0, 0, 0];
        var sprite = new THREE.TextureLoader().load( '/assets/textures/sprites/disc.png' );
        geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( originPoint, 3 ) );
        material = new THREE.PointsMaterial( { size: 25, sizeAttenuation: false, map: sprite, alphaTest: 0.5, transparent: true } );
        material.color.setHSL( 1.0, 1.0, 0.5 );
        var particles = new THREE.Points( geometry, material );
        this.scene.add( particles );
    },
    DisposeObjects: function() {
        if(this.points) {
            this.scene.remove(this.points);
            this.points = null;
        }
        for(var i = 0; i < this.objects.length; i++) {
            var obj = this.objects[i];
            this.scene.remove(obj);
            obj.geometry.dispose();
            obj.material.dispose();
            obj = undefined;
        }
    },
    InitGUI: function() {
        this.UI.instance = new dat.GUI({ autoplace: false });
        var convexHullOption;

        document.getElementById("minkowski-view").appendChild(this.UI.instance.domElement);

        this.UI.instance.add( minkowskiView, 'showConsole' ).name( 'Show log' ).onChange( function ( value ) {
            if(minkowskiView.showConsole) {
                minkowskiView.console.style.display = "block";
            }
            else {
                minkowskiView.console.style.display = "none";
            }
        } );

        this.UI.addConvexHullOption = this.UI.instance.add( minkowskiView, 'showConvexHull' ).name( 'Show M.difference' ).onChange( function ( value ) {
            if(minkowskiView.showConvexHull) {
                minkowskiView.WriteToConsole("Showing minkowski difference convex hull");
            }
            else {
                minkowskiView.WriteToConsole("Hiding minkowski difference convex hull");
            }
            minkowskiView.GenerateMinkowskiDifference();
        } );

        this.UI.addShowSimplexConstructionOption = (function () {
            this.UI.showSimplexConstructionOption = this.UI.instance.add( minkowskiView, 'ShowSimplexConstruction' ).name( 'Build simplex' );
        }).bind(this);

        this.UI.addShowSimplexConstructionOption();
    },
    InitTextSprites() {
        for(var i = 0; i < 4; i++) {
            var letter;
            switch(i) {
                case 0:
                    letter = "A";
                break;
                case 1:
                    letter = "B";
                break;
                case 2:
                    letter = "C";
                break;
                case 3:
                    letter = "D";
                break;
            }

            this.textSprites.push(new THREE.TextSprite({
                material: {
                    color: 0xffbbff
                },
                redrawInterval: 1,
                textSize: 2,
                texture: {
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    text: letter,
                },  
            }));
            this.scene.add(this.textSprites[i]);
        }
        this.UpdateTextSprites();
    },
    UpdateTextSprites() {
        if(this.textSprites.length == 0)
            return;

        for(var i = 0; i < this.simplexPoints.length; i++) {
            this.textSprites[i].position.set(this.simplexPoints[i].x, this.simplexPoints[i].y, this.simplexPoints[i].z);
        }
        for(var j = 0; j < 4 - this.simplexPoints.length; j++) {
            this.textSprites[3-j].position.set(999,999,999);
        }
    },
    ShowSimplexConstruction: function () {
        this.UI.instance.remove(this.UI.showSimplexConstructionOption);
        objectView.RemoveControls();

        minkowskiView.WriteToConsole("Building simplex for objects' current positions...");

        this.UI.nextSimplexStepOption = this.UI.instance.add(minkowskiView, "ShowNextSimplexStep").name("Next Step");

        this.simplexPoints = [];
        this.ShowNextSimplexStep();
    },
    ShowNextSimplexStep: function() {
        if(this.simplexPoints.length == 0) {
            minkowskiView.WriteToConsole("Initializing simplex by picking any support vertex.");
            var support = this.CalculateFurthestPointAlong();
            this.simplexPoints.push(support);
            this.simplexDirection = support.clone().negate();
            this.simplexDirectionObjectOrigin = support;
            minkowskiView.WriteToConsole("Setting search dir to the opposide of the support vertex direction from origin...");
        }
        else {
            if(this.isSupportStep) {
                this.nextPoint = this.CalculateFurthestPointAlong(this.simplexDirection);
                this.simplexPoints.push(this.nextPoint);
            }
            else {
                if(this.nextPoint.dot(this.simplexDirection) < 0) {
                    //NO INTERSECTION
                    minkowskiView.WriteToConsole("There are no points past the origin in this direction. No intersection was found.");

                    objectView.InitControls();
                    this.UI.instance.remove(this.UI.nextSimplexStepOption);
                    this.UI.addShowSimplexConstructionOption();
                    this.isSupportStep = true;
                    return;
                }
                this.DoSimplex();
            }
            
            this.isSupportStep = !this.isSupportStep;
        }

        this.RenderSimplex();

        if(this.simplexDirectionObject) {
            this.scene.remove(this.simplexDirectionObject);
        }

        if(this.isSimplexDone) {
            //Tetrahedron is done
            objectView.InitControls();
            this.UI.instance.remove(this.UI.nextSimplexStepOption);
            this.UI.addShowSimplexConstructionOption();
            this.isSupportStep = true;
            this.isSimplexDone = false;
            this.Render();
            return;
        }

        var origin = new THREE.Vector3( 0, 0, 0 );
        var length = 5;
        var hex = 0xffff00;

        this.simplexDirectionObject = new THREE.ArrowHelper( this.simplexDirection.clone().normalize(), this.simplexDirectionObjectOrigin, length, hex );
        this.scene.add( this.simplexDirectionObject );

        this.Render();
    },
    RenderSimplex() {
        this.DisposeSimplex();

        switch(this.simplexPoints.length) {
            case 2:
                var material = new THREE.LineBasicMaterial( { color: 0xff00ff } );
                var geometry = new THREE.Geometry();
                geometry.vertices = this.simplexPoints;
                this.simplexObject = new THREE.Line( geometry, material );
                this.scene.add(this.simplexObject);
                break;
            case 3:
                var material = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    wireframe: true
                });
                var geometry = new THREE.Geometry();
                geometry.vertices = this.simplexPoints;
                geometry.faces.push(new THREE.Face3(0, 1, 2));
                this.simplexObject = new THREE.Mesh( geometry, material );
                this.scene.add(this.simplexObject);
                break;
            case 4:
                var material = new THREE.MeshBasicMaterial({
                    color: 0xff00ff,
                    wireframe: true
                });
                var geometry = new THREE.Geometry();
                geometry.vertices = this.simplexPoints;
                geometry.faces.push(new THREE.Face3(0, 1, 2));
                geometry.faces.push(new THREE.Face3(0, 2, 3));
                geometry.faces.push(new THREE.Face3(0, 1, 3));
                geometry.faces.push(new THREE.Face3(1, 2, 3));
                this.simplexObject = new THREE.Mesh( geometry, material );
                this.scene.add(this.simplexObject);
                break;
        }
        
        this.UpdateTextSprites();
    },
    DisposeSimplex() {
        if (this.simplexObject) {
            this.scene.remove(this.simplexObject);
            this.simplexObject.geometry.dispose();
            this.simplexObject.material.dispose();
        }
    },
    DoSimplex() {
        if(this.simplexPoints.length == 2) {
            minkowskiView.WriteToConsole("2 vertices currently in simplex");
            minkowskiView.WriteToConsole("Origin is towards AB direction");
            var A = this.simplexPoints[0];
            var B = this.simplexPoints[1];
            var AB = A.clone().sub(B);
            var BO = B.clone().negate();
            
            this.simplexDirectionObjectOrigin = A.clone().add(B).divideScalar(2);
            this.simplexDirection = AB.clone().cross(BO).cross(AB);
        }
        else if(this.simplexPoints.length == 3) {
            minkowskiView.WriteToConsole("3 vertices currently in simplex");

            var A = this.simplexPoints[0];
            var B = this.simplexPoints[1];
            var C = this.simplexPoints[2];
            
            var CO = C.clone().negate();
            
            var CB = B.clone().sub(C);
            var CA = A.clone().sub(C);
            var CBA = CB.clone().cross(CA);
            var O = new THREE.Vector3();

            if(CBA.clone().cross(CA).dot(CO) > 0) {
                if(CA.dot(CO) > 0) {
                    this.simplexPoints = [C, A];

                    minkowskiView.WriteToConsole("Origin is towards AC direction. Removing vertex B");
                    minkowskiView.WriteToConsole("Reassigning vertex letters...");

                    this.simplexDirectionObjectOrigin = A.clone().add(C).divideScalar(2);
                    this.simplexDirection = CA.clone().cross(CO).cross(CA);
                }
                else if (CB.dot(CO) > 0) {
                    this.simplexPoints = [B, C];
                    
                    minkowskiView.WriteToConsole("Origin is towards BC direction. Removing vertex A");
                    minkowskiView.WriteToConsole("Reassigning vertex letters...");

                    this.simplexDirectionObjectOrigin = B.clone().add(A).divideScalar(2);
                    this.simplexDirection = CB.clone().cross(CO).cross(CB);
                }
                else {
                    this.simplexPoints = [C];

                    minkowskiView.WriteToConsole("Origin is towards C direction. Removing vertices A and B");
                    minkowskiView.WriteToConsole("Reassigning vertex letters...");

                    this.simplexDirectionObjectOrigin = C;
                    this.simplexDirection = CO;
                }
            }
            else {
                if(CB.clone().cross(CBA).dot(CO) > 0) {
                    if (CB.dot(CO) > 0) {
                        this.simplexPoints = [B, C];

                        minkowskiView.WriteToConsole("Origin is towards BC direction. Removing vertex A");
                        minkowskiView.WriteToConsole("Reassigning vertex letters...");

                        this.simplexDirectionObjectOrigin = B.clone().add(C).divideScalar(2);
                        this.simplexDirection = CB.clone().cross(CO).cross(CB);
                    }
                    else {
                        this.simplexPoints = [C];
                        
                        minkowskiView.WriteToConsole("Origin is towards C direction. Removing vertices A and B");
                        minkowskiView.WriteToConsole("Reassigning vertex letters...");

                        this.simplexDirectionObjectOrigin = C;
                        this.simplexDirection = CO;
                    }
                }
                else if (CBA.clone().dot(CO) > 0) {
                    this.simplexPoints = [B, A, C];

                    minkowskiView.WriteToConsole("Origin is towards B, A, C direction");

                    this.simplexDirectionObjectOrigin = B.clone().add(A).add(C).divideScalar(3);
                    this.simplexDirection = CBA;
                }
                else {
                    this.simplexPoints = [A, B, C];

                    minkowskiView.WriteToConsole("Origin is towards A, B, C direction");

                    this.simplexDirectionObjectOrigin = B.clone().add(A).add(C).divideScalar(3);
                    this.simplexDirection = CBA.clone().negate();
                }
            }
        }
        else if(this.simplexPoints.length == 4) {
            var A = this.simplexPoints[0];
            var B = this.simplexPoints[1];
            var C = this.simplexPoints[2];
            var D = this.simplexPoints[3];
            
            var DO = D.clone().negate();
            var DC = C.clone().sub(D);
            var DB = B.clone().sub(D);
            var DA = A.clone().sub(D);
            var DBC = DB.clone().cross(DC);
            var DAB = DA.clone().cross(DB);
            var DCA = DC.clone().cross(DA);

            var O = new THREE.Vector3();

            if(DBC.dot(DO) > 0) {
                this.simplexPoints = [D, B, C];

                minkowskiView.WriteToConsole("Origin is outside tetrahedron. Removing vertex A");
                minkowskiView.WriteToConsole("Reassigning vertex letters...");

                this.simplexDirectionObjectOrigin = D.clone().add(B).add(C).divideScalar(3);
                this.simplexDirection = DBC;
            }
            else if(DAB.dot(DO) > 0) {
                this.simplexPoints = [D, A, B];
                
                minkowskiView.WriteToConsole("Origin is outside tetrahedron. Removing vertex C");
                minkowskiView.WriteToConsole("Reassigning vertex letters...");

                this.simplexDirectionObjectOrigin = D.clone().add(A).add(B).divideScalar(3);
                this.simplexDirection = DAB;
            }
            else if(DCA.dot(DO) > 0) {
                this.simplexPoints = [D, C, A];
                
                minkowskiView.WriteToConsole("Origin is outside tetrahedron. Removing vertex B");
                minkowskiView.WriteToConsole("Reassigning vertex letters...");

                this.simplexDirectionObjectOrigin = D.clone().add(C).add(A).divideScalar(3);
                this.simplexDirection = DCA;
            }
            else {
                // Origin is contained
                this.isSimplexDone = true;
                minkowskiView.WriteToConsole("Origin is enclosed in tetrahedron");
                minkowskiView.WriteToConsole("Collision detected.");
            }
        }
    },
    CalculateFurthestPointAlong: function(direction = undefined) {
        if(!direction) {
            direction = new THREE.Vector3(Math.random(), Math.random(), Math.random());
        }

        direction = direction.clone();

        var vertA;
        var maxDistA = Number.NEGATIVE_INFINITY;
        var vertB;
        var maxDistB = Number.NEGATIVE_INFINITY;
        for(var i = 0; i < objectView.objects[0].geometry.vertices.length; i++) {
            var vert = objectView.objects[0].geometry.vertices[i].clone();
            vert.applyMatrix4(objectView.objects[0].matrixWorld);

            var dist = vert.dot(direction);
            if(dist > maxDistA) {
                maxDistA = dist;
                vertA = vert;
            }
        }

        direction.negate();

        for(var i = 0; i < objectView.objects[1].geometry.vertices.length; i++) {
            var vert = objectView.objects[1].geometry.vertices[i].clone();
            vert.applyMatrix4(objectView.objects[1].matrixWorld);

            var dist = vert.dot(direction);
            if(dist > maxDistB) {
                maxDistB = dist;
                vertB = vert;
            }
        }

        vertA.sub(vertB);
        
        minkowskiView.WriteToConsole("Found furthest point along assigned direction");
        return vertA;
    },
    GenerateMinkowskiDifference: function() {
        this.DisposeObjects();
        this.DisposeSimplex();
        this.simplexPoints = [];
        this.UpdateTextSprites();

        if(!this.showConvexHull) {
            this.Render();
            return;
        }

        var vertices = [];
        var vertsA = [];
        var vertsB = [];
        for(var j = 0; j < objectView.objects[0].geometry.vertices.length; j++) {
            var vert = objectView.objects[0].geometry.vertices[j].clone();
            vertsA.push(vert.applyMatrix4(objectView.objects[0].matrixWorld));
        }
        for(var j = 0; j < objectView.objects[1].geometry.vertices.length; j++) {
            var vert = objectView.objects[1].geometry.vertices[j].clone();
            vertsB.push(vert.applyMatrix4(objectView.objects[1].matrixWorld));
        }

        for(var i = 0; i < vertsA.length; i++) {
            for(var j = 0; j < vertsB.length; j++) {
                var v = vertsA[i].clone();
                v.sub(vertsB[j]);
                vertices.push(v);
            }
        }

        // textures
        var loader = new THREE.TextureLoader();
        var texture = loader.load( '/assets/textures/sprites/disc.png' );
        
        var meshMaterial = new THREE.MeshLambertMaterial( {
            color: 0x44ffff,
            opacity: 0.2,
            transparent: true
        } );


        var meshGeometry = new THREE.ConvexBufferGeometry( vertices );
        var backMesh = new THREE.Mesh( meshGeometry, meshMaterial );
        backMesh.material.side = THREE.BackSide; // back faces
        backMesh.renderOrder = 0;
        this.scene.add( backMesh );

        var frontMesh = new THREE.Mesh( meshGeometry, meshMaterial.clone() );
        frontMesh.material.side = THREE.FrontSide; // front faces
        frontMesh.renderOrder = 1;
        this.scene.add( frontMesh );

        this.objects.push(frontMesh);
        this.objects.push(backMesh);

        var pointsMaterial = new THREE.PointsMaterial( {
            color: 0x0080ff,
            map: texture,
            size: 3,
            alphaTest: 0.5
        } );
        var pointsGeometry = new THREE.BufferGeometry().setFromPoints( vertices );
        this.points = new THREE.Points( pointsGeometry, pointsMaterial );
        this.scene.add( this.points );

        this.Render();
    },
    Render: function() {
        this.renderer.render( this.scene, this.camera );
    },
};

objectView.Init();
minkowskiView.Init();