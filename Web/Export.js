import {
	Serialize
}	from './Application.js'

export	const
baseName	= $ => {
	$ = ( $ || '' ).trim().replace( /\.svg$/i, '' )
	return $ || 'Untitled'
}

export	const
downloadBlob	= ( blob, name ) => {
	const
	a = document.createElement( 'a' )
	a.href		= URL.createObjectURL( blob )
	a.download	= name
	a.click()
	setTimeout( () => URL.revokeObjectURL( a.href ), 1000 )
}

export	const
SVGText	= () => `<?xml version="1.0" encoding="UTF-8"?>\n${ Serialize() }`

export	const
saveSVG	= name => downloadBlob(
	new Blob( [ SVGText() ], { type: 'image/svg+xml' } )
,	`${ baseName( name ) }.svg`
)

export	const
copySVG	= () => navigator.clipboard.writeText( SVGText() )

export	const
exportPNG	= ( name, scale = 2 ) => new Promise(
	( R_, J ) => {
		const
		svg = MAIN_EDITOR.SVG()
		const
		W = parseFloat( svg.getAttribute( 'width' ) ) || 512
	,	H = parseFloat( svg.getAttribute( 'height' ) ) || 512
		const
		url = URL.createObjectURL( new Blob( [ SVGText() ], { type: 'image/svg+xml' } ) )
		const
		img = new Image()
		img.onload = () => {
			const
			canvas = document.createElement( 'canvas' )
			canvas.width	= Math.round( W * scale )
			canvas.height	= Math.round( H * scale )
			canvas.getContext( '2d' ).drawImage( img, 0, 0, canvas.width, canvas.height )
			URL.revokeObjectURL( url )
			canvas.toBlob(
				blob => blob
					?	( downloadBlob( blob, `${ baseName( name ) }.png` ), R_() )
					:	J( new Error( 'PNG export failed.' ) )
			,	'image/png'
			)
		}
		img.onerror = () => ( URL.revokeObjectURL( url ), J( new Error( 'PNG export failed to rasterize.' ) ) )
		img.src = url
	}
)

export	const
printPDF	= name => {
	const
	w = window.open( '', '_blank' )
	if	( !w ) throw new Error( 'Popup blocked — allow popups to export PDF.' )
	w.document.write( `<!DOCTYPE html><title>${ baseName( name ) }</title><style>body{margin:0}</style>${ Serialize() }` )
	w.document.close()
	w.focus()
	setTimeout( () => w.print(), 200 )
}
