//	Path `d` parsing / serialization for on-canvas point editing.

const
ARITY	= { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }

const
R	= $ => Math.round( $ * 100 ) / 100

export	const
ParseD	= d => {
	const
	tokens = ( d || '' ).match( /[MLHVCSQTAZ]|-?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/gi ) || []
	const
	segs = []
	let	i = 0
	,	cmd = null
	while	( i < tokens.length ) {
		const
		t = tokens[ i ]
		ARITY[ t.toUpperCase() ] !== undefined && isNaN( Number( t ) ) && ( cmd = t, i++ )
		if	( !cmd ) break
		const
		A = ARITY[ cmd.toUpperCase() ]
		if	( !A ) {
			segs.push( { c: cmd, n: [] } )
			cmd = null
			continue
		}
		const
		n = tokens.slice( i, i + A ).map( Number )
		if	( n.length < A || n.some( isNaN ) ) break
		i += A
		segs.push( { c: cmd, n } )
		//	implicit repetition: extra pairs after M / m continue as L / l
		cmd.toUpperCase() === 'M' && ( cmd = cmd === 'M' ? 'L' : 'l' )
	}
	return segs
}

//	Parse and normalize to absolute commands ( H / V become L ) so every
//	editable coordinate is a plain absolute pair.
export	const
AbsD	= d => {
	let	x = 0, y = 0, sx = 0, sy = 0
	return ParseD( d ).map(
		s => {
			const
			C = s.c.toUpperCase()
		,	rel = s.c !== C
			const
			n = [ ...s.n ]
			switch ( C ) {
			case 'H'	:
				rel && ( n[ 0 ] += x )
				x = n[ 0 ]
				return { c: 'L', n: [ x, y ] }
			case 'V'	:
				rel && ( n[ 0 ] += y )
				y = n[ 0 ]
				return { c: 'L', n: [ x, y ] }
			case 'A'	:
				rel && ( n[ 5 ] += x, n[ 6 ] += y )
				x = n[ 5 ], y = n[ 6 ]
				return { c: 'A', n }
			case 'Z'	:
				x = sx, y = sy
				return { c: 'Z', n: [] }
			default		:	//	M L C S Q T — lists of coordinate pairs
				rel && n.forEach( ( _, i ) => n[ i ] += i % 2 ? y : x )
				x = n[ n.length - 2 ], y = n[ n.length - 1 ]
				C === 'M' && ( sx = x, sy = y )
				return { c: C, n }
			}
		}
	)
}

export	const
SerializeD	= segs => segs.map(
	_ => `${ _.c }${ _.n.length ? ` ${ _.n.map( R ).join( ' ' ) }` : '' }`
).join( ' ' )

//	Editable points of absolute segments: anchors and control points,
//	each addressed by ( segment index i, pair index j ). Control points
//	carry the anchor ( ax, ay ) they belong to, for the guide line.
export	const
PathPoints	= segs => {
	const
	pts = []
	let	px = 0, py = 0
	segs.forEach(
		( s, i ) => {
			const
			n = s.n
			switch ( s.c ) {
			case 'M'	:
			case 'L'	:
			case 'T'	:
				pts.push( { i, j: 0, x: n[ 0 ], y: n[ 1 ] } )
				px = n[ 0 ], py = n[ 1 ]
				break
			case 'C'	:
				pts.push( { i, j: 0, x: n[ 0 ], y: n[ 1 ], ctrl: true, ax: px, ay: py } )
				pts.push( { i, j: 1, x: n[ 2 ], y: n[ 3 ], ctrl: true, ax: n[ 4 ], ay: n[ 5 ] } )
				pts.push( { i, j: 2, x: n[ 4 ], y: n[ 5 ] } )
				px = n[ 4 ], py = n[ 5 ]
				break
			case 'S'	:
				pts.push( { i, j: 0, x: n[ 0 ], y: n[ 1 ], ctrl: true, ax: n[ 2 ], ay: n[ 3 ] } )
				pts.push( { i, j: 1, x: n[ 2 ], y: n[ 3 ] } )
				px = n[ 2 ], py = n[ 3 ]
				break
			case 'Q'	:
				pts.push( { i, j: 0, x: n[ 0 ], y: n[ 1 ], ctrl: true, ax: px, ay: py } )
				pts.push( { i, j: 1, x: n[ 2 ], y: n[ 3 ] } )
				px = n[ 2 ], py = n[ 3 ]
				break
			case 'A'	:
				pts.push( { i, j: 0, x: n[ 5 ], y: n[ 6 ] } )
				px = n[ 5 ], py = n[ 6 ]
				break
			}
		}
	)
	return pts
}

export	const
SetPathPoint	= ( seg, j, x, y ) => {
	seg.c === 'A'
		?	( seg.n[ 5 ] = x, seg.n[ 6 ] = y )
		:	( seg.n[ j * 2 ] = x, seg.n[ j * 2 + 1 ] = y )
}
