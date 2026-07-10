import {
	SVG_NS
,	NE
,	STORAGE_KEY
,	Serialize
,	Parse
,	Mutate
,	Commit
,	CaptureSelection
}	from './Application.js'

import {
	AbsD
,	SerializeD
,	PathPoints
,	SetPathPoint
}	from './PathD.js'

const
GRAPHICAL	= new Set( [ 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'image', 'g', 'use' ] )

const
R	= $ => Math.round( $ * 100 ) / 100
const
R4	= $ => Math.round( $ * 10000 ) / 10000

//	Transform a vector / a point by a DOMMatrix.
const
Vec	= ( m, x, y ) => [ m.a * x + m.c * y, m.b * x + m.d * y ]
const
Pt	= ( m, x, y ) => {
	const
	p = new DOMPoint( x, y ).matrixTransform( m )
	return [ p.x, p.y ]
}

const
NAttr	= ( el, name, def = 0 ) => {
	const
	_ = parseFloat( el.getAttribute( name ) )
	return isNaN( _ ) ? def : _
}

const
HANDLE_CURSORS	= {
	nw	: 'nwse-resize'
,	n	: 'ns-resize'
,	ne	: 'nesw-resize'
,	e	: 'ew-resize'
,	se	: 'nwse-resize'
,	s	: 'ns-resize'
,	sw	: 'nesw-resize'
,	w	: 'ew-resize'
}

const
ParsePoints	= $ => {
	const
	ns = ( $ || '' ).trim().split( /[\s,]+/ ).map( Number )
	const
	pts = []
	for	( let i = 0; i + 1 < ns.length; i += 2 ) isNaN( ns[ i ] ) || isNaN( ns[ i + 1 ] ) || pts.push( [ ns[ i ], ns[ i + 1 ] ] )
	return pts
}

//	line / polyline / polygon are edited per-point.
const
POINTY	= new Set( [ 'line', 'polyline', 'polygon' ] )

const
GetPoints	= el => el.localName === 'line'
	?	[ [ NAttr( el, 'x1' ), NAttr( el, 'y1' ) ], [ NAttr( el, 'x2' ), NAttr( el, 'y2' ) ] ]
	:	ParsePoints( el.getAttribute( 'points' ) )

const
SetPoints	= ( el, pts ) => el.localName === 'line'
	?	(	el.setAttribute( 'x1', R( pts[ 0 ][ 0 ] ) )
		,	el.setAttribute( 'y1', R( pts[ 0 ][ 1 ] ) )
		,	el.setAttribute( 'x2', R( pts[ 1 ][ 0 ] ) )
		,	el.setAttribute( 'y2', R( pts[ 1 ][ 1 ] ) )
		)
	:	el.setAttribute( 'points', pts.map( _ => `${ R( _[ 0 ] ) },${ R( _[ 1 ] ) }` ).join( ' ' ) )

//	Per-tag base values captured at drag start. Elements without positional
//	attributes are moved by appending a translate to their transform.
const
MoveBase	= el => {
	switch ( el.localName ) {
	case 'rect'		:
	case 'image'	:
	case 'use'		:
		return { x: NAttr( el, 'x' ), y: NAttr( el, 'y' ) }
	case 'circle'	:
	case 'ellipse'	:
		return { cx: NAttr( el, 'cx' ), cy: NAttr( el, 'cy' ) }
	case 'line'		:
		return { x1: NAttr( el, 'x1' ), y1: NAttr( el, 'y1' ), x2: NAttr( el, 'x2' ), y2: NAttr( el, 'y2' ) }
	default			: {
		const
		_ = el.getAttribute( 'transform' )
		return { transform: _ ? `${ _ } ` : '' }
	}
	}
}

//	dxs / dys are screen px; each item carries the inverse screen CTM
//	captured at drag start, so the delta lands in the element's own units.
const
ApplyMove	= ( { el, inv, base }, dxs, dys ) => {
	const
	[ vx, vy ] = Vec( inv, dxs, dys )
	switch ( el.localName ) {
	case 'rect'		:
	case 'image'	:
	case 'use'		:
		el.setAttribute( 'x', R( base.x + vx ) )
	,	el.setAttribute( 'y', R( base.y + vy ) )
		break
	case 'circle'	:
	case 'ellipse'	:
		el.setAttribute( 'cx', R( base.cx + vx ) )
	,	el.setAttribute( 'cy', R( base.cy + vy ) )
		break
	case 'line'		:
		el.setAttribute( 'x1', R( base.x1 + vx ) )
	,	el.setAttribute( 'y1', R( base.y1 + vy ) )
	,	el.setAttribute( 'x2', R( base.x2 + vx ) )
	,	el.setAttribute( 'y2', R( base.y2 + vy ) )
		break
	default			:
		el.setAttribute( 'transform', `${ base.transform }translate(${ R( vx ) } ${ R( vy ) })` )
	}
}

//	Collapse an accumulated transform list into a single translate / matrix.
const
Bake	= el => {
	const
	l = el.transform?.baseVal
	if	( !l || !l.numberOfItems ) return
	const
	m = l.consolidate()?.matrix
	if	( !m ) return
	m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && !m.e && !m.f
		?	el.removeAttribute( 'transform' )
		:	el.setAttribute(
				'transform'
			,	m.b === 0 && m.c === 0 && m.a === 1 && m.d === 1
					?	`translate(${ R( m.e ) } ${ R( m.f ) })`
					:	`matrix(${ [ m.a, m.b, m.c, m.d, m.e, m.f ].map( R4 ).join( ' ' ) })`
			)
}

const
StripIDs	= el => {
	el.removeAttribute( 'id' )
	el.querySelectorAll( '[id]' ).forEach( _ => _.removeAttribute( 'id' ) )
}

const
Describe	= el => `<${ el.localName }${ el.id ? ` id=${ el.id }` : '' }>`

class EzuEditor extends HTMLElement {

	connectedCallback() {
		if	( this.wrap ) return
		this.wrap				= document.createElement( 'div' )
		this.wrap.className		= 'doc-wrap'
		this.overlay			= NE( 'svg', { class: 'overlay' } )
		this.wrap.append( this.overlay )
		this.append( this.wrap )
		this.svg		= null
		this.selected	= []
		this.hover		= null
		this.gesture	= null
		this.buffer		= ''
		this.tool		= 'select'
		this.zoom		= +localStorage.getItem( `${ STORAGE_KEY }.zoom` ) || 1

		this.addEventListener( 'pointerdown'	, ev => this.Down( ev ) )
		this.addEventListener( 'pointermove'	, ev => this.PMove( ev ) )
		this.addEventListener( 'pointerup'		, ev => this.Up( ev ) )
		this.addEventListener( 'pointercancel'	, () => this.CancelGesture() )
		this.addEventListener( 'pointerleave'	, () => this.SetHover( null ) )
		this.addEventListener( 'dblclick'		, ev => this.Dbl( ev ) )
		this.addEventListener( 'contextmenu'	, ev => this.Menu( ev ) )
		this.addEventListener(
			'wheel'
		,	ev => {
				if	( !( ev.metaKey || ev.ctrlKey ) ) return
				ev.preventDefault()
				this.SetZoom( this.zoom * ( ev.deltaY < 0 ? 1.1 : 1 / 1.1 ) )
			}
		,	{ passive: false }
		)
	}

	SVG()		{ return this.svg }
	Selected()	{ return this.selected }

	SetSVG( svg ) {
		this.svg?.remove()
		this.svg = svg
		this.wrap.insertBefore( svg, this.overlay )
		this.selected	= []
		this.hover		= null
		this.gesture	= null
		this.DispatchSelection()
		this.Draw()
	}

	DispatchSelection() {
		window.dispatchEvent( new Event( 'selection-changed' ) )
	}

	Select( els ) {
		this.selected = els.filter( _ => this.svg?.contains( _ ) )
		this.DispatchSelection()
		this.Draw()
	}

	SelectAll() {
		this.Select( [ ...this.svg.children ].filter( _ => GRAPHICAL.has( _.localName ) ) )
	}

	SetHover( el ) {
		this.hover = el
		UNDER_HOVER.style.display = ''
		this.Draw()
	}

	SetTool( t ) {
		this.tool = t
		this.dataset.tool = t
		window.dispatchEvent( new Event( 'tool-changed' ) )
	}

	SetZoom( z ) {
		this.zoom = Math.min( 8, Math.max( .1, z ) )
		localStorage.setItem( `${ STORAGE_KEY }.zoom`, this.zoom )
		ZOOM_PCT.textContent = `${ Math.round( this.zoom * 100 ) }%`
		this.Draw()
	}

	DocSize() {
		return [
			NAttr( this.svg, 'width', 512 )
		,	NAttr( this.svg, 'height', 512 )
		,	this.svg.getAttribute( 'viewBox' ) || ''
		]
	}

	SetDocSize( W, H, vb ) {
		Mutate(
			'Canvas'
		,	() => (
				this.svg.setAttribute( 'width', W )
			,	this.svg.setAttribute( 'height', H )
			,	vb && this.svg.setAttribute( 'viewBox', vb )
			)
		)
	}

	Layout() {
		if	( !this.svg ) return
		this.wrap.style.width	= `${ NAttr( this.svg, 'width', 512 ) * this.zoom }px`
		this.wrap.style.height	= `${ NAttr( this.svg, 'height', 512 ) * this.zoom }px`
	}

	//	Nearest selectable element for a raw event target.
	PickEl( t ) {
		if	( !this.svg || !( t instanceof Element ) || !this.svg.contains( t ) || t === this.svg ) return null
		let
		el = t
		while	( el !== this.svg && !GRAPHICAL.has( el.localName ) ) el = el.parentNode
		if	( el === this.svg || el.closest( 'defs' ) ) return null
		return el
	}

	//	Prefer an already-selected ancestor (keeps groups grabbable).
	Resolve( el ) {
		for	( let _ = el; _ && _ !== this.svg; _ = _.parentNode )
			if	( this.selected.includes( _ ) ) return _
		return el
	}

	Down( ev ) {
		if	( ev.button !== 0 || !this.svg ) return
		const
		handle = ev.target.closest?.( '[data-handle]' )
		if	( handle ) return this.StartResize( handle.dataset.handle, ev )
		const
		tool = ev.metaKey ? 'rect' : ev.altKey ? 'ellipse' : this.tool
		tool === 'select'
			?	this.StartSelect( ev )
			:	this.StartDraw( tool, ev )
	}

	StartSelect( ev ) {
		const
		deepest = this.PickEl( ev.target )
		if	( !deepest ) {
			ev.shiftKey || this.Select( [] )
			this.gesture = { type: 'marquee', x0: ev.clientX, y0: ev.clientY, x1: ev.clientX, y1: ev.clientY, add: ev.shiftKey }
			this.setPointerCapture( ev.pointerId )
			return this.Draw()
		}
		const
		el = this.Resolve( deepest )
		if	( ev.shiftKey ) return this.Select(
			this.selected.includes( el )
				?	this.selected.filter( _ => _ !== el )
				:	[ ...this.selected, el ]
		)
		const
		was = this.selected.includes( el )
		was || this.Select( [ el ] )
		this.gesture = {
			type	: 'move'
		,	x0		: ev.clientX
		,	y0		: ev.clientY
		,	before	: Serialize()
		,	beforeSel: CaptureSelection()
		,	moved	: false
		,	cycle	: was ? { el, deepest } : null
		,	items	: this.selected.map(
				el => {
					const
					m = el.getScreenCTM?.()
					return m && { el, inv: m.inverse(), base: MoveBase( el ) }
				}
			).filter( _ => _ )
		}
		this.setPointerCapture( ev.pointerId )
	}

	StartResize( name, ev ) {
		const
		el = this.selected[ 0 ]
		const
		m = el?.getScreenCTM?.()
		if	( !m ) return
		let
		b0 = null
		try { b0 = el.getBBox() } catch {}
		if	( !b0 ) return
		const
		useTransform = !POINTY.has( el.localName )
			&& ![ 'rect', 'image', 'circle', 'ellipse' ].includes( el.localName )
			&& !name.startsWith( 'pd-' )
		const
		_ = el.getAttribute( 'transform' )
		this.gesture = {
			type	: 'resize'
		,	el
		,	name
		,	b0
		,	inv		: m.inverse()
		,	before	: Serialize()
		,	beforeSel: CaptureSelection()
		,	x0		: ev.clientX
		,	y0		: ev.clientY
		,	baseT	: useTransform ? ( _ ? `${ _ } ` : '' ) : null
		,	pts		: name.startsWith( 'pt-' ) ? GetPoints( el ) : null
		,	pd		: name.startsWith( 'pd-' ) ? AbsD( el.getAttribute( 'd' ) ) : null
		}
		this.setPointerCapture( ev.pointerId )
	}

	StartDraw( tool, ev ) {
		const
		m = this.svg.getScreenCTM?.()
		if	( !m ) return
		const
		inv = m.inverse()
		const
		[ px, py ] = Pt( inv, ev.clientX, ev.clientY )
		const
		before = Serialize()
		,	beforeSel = CaptureSelection()
		const
		D = PROP_EDITOR.Defaults()
		if	( tool === 'text' ) {
			const
			el = NE(
				'text'
			,	{	x				: R( px )
				,	y				: R( py )
				,	'font-size'		: D[ 'font-size' ] || 16
				,	'font-family'	: 'sans-serif'
				,	fill			: D.fill || '#000'
				}
			)
			el.textContent = 'Text'
			this.svg.append( el )
			this.Select( [ el ] )
			Commit( 'Text', before, beforeSel )
			window.dispatchEvent( new CustomEvent( 'text-edit', { detail: el } ) )
			return
		}
		const
		paint = {}
		D.fill && ( paint.fill = D.fill )
		D.stroke && D.stroke !== 'none' && (
			paint.stroke = D.stroke
		,	paint[ 'stroke-width' ] = D[ 'stroke-width' ] || 2
		)
		D.opacity && +D.opacity !== 1 && ( paint.opacity = D.opacity )
		const
		lineStroke	= D.stroke && D.stroke !== 'none' ? D.stroke : D.fill || '#333'
	,	lineWidth	= D[ 'stroke-width' ] || 2
		const
		el	= tool === 'rect'
				?	NE( 'rect', { x: R( px ), y: R( py ), width: 0, height: 0, ...paint } )
			:	tool === 'ellipse'
				?	NE( 'ellipse', { cx: R( px ), cy: R( py ), rx: 0, ry: 0, ...paint } )
			:	tool === 'line'
				?	NE( 'line', { x1: R( px ), y1: R( py ), x2: R( px ), y2: R( py ), stroke: lineStroke, 'stroke-width': lineWidth, 'stroke-linecap': 'round' } )
			:		NE( 'path', { d: `M ${ R( px ) } ${ R( py ) }`, fill: 'none', stroke: lineStroke, 'stroke-width': lineWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } )
		this.svg.append( el )
		this.gesture = { type: 'draw', tool, el, px, py, before, beforeSel, inv, pts: [ [ px, py ] ], x0: ev.clientX, y0: ev.clientY, moved: false }
		this.setPointerCapture( ev.pointerId )
	}

	PMove( ev ) {
		const
		g = this.gesture
		if	( !g ) return this.Hover( ev )
		switch ( g.type ) {
		case 'move'		: {
			const
			dx = ev.clientX - g.x0
		,	dy = ev.clientY - g.y0
			g.moved || ( g.moved = Math.hypot( dx, dy ) > 3 )
			g.moved && g.items.forEach( _ => ApplyMove( _, dx, dy ) )
			break
		}
		case 'marquee'	:
			g.x1 = ev.clientX
		,	g.y1 = ev.clientY
			break
		case 'resize'	:
			this.ApplyResize( g, ev )
			break
		case 'draw'		:
			this.ApplyDraw( g, ev )
			break
		}
		this.Draw()
	}

	Hover( ev ) {
		const
		el = this.tool === 'select' ? this.PickEl( ev.target ) : null
		el === this.hover || ( this.hover = el, this.Draw() )
		if	( el ) {
			UNDER_HOVER.style.display	= 'block'
			UNDER_HOVER.style.left		= `${ ev.clientX + 12 }px`
			UNDER_HOVER.style.top		= `${ ev.clientY + 14 }px`
			UNDER_HOVER.textContent		= Describe( el )
		} else UNDER_HOVER.style.display = ''
	}

	ApplyResize( g, ev ) {
		const
		{ el, inv, name, b0 } = g
		if	( g.pd ) {
			const
			[ , si, pj ] = name.split( '-' ).map( Number )
			const
			[ px, py ] = Pt( inv, ev.clientX, ev.clientY )
			SetPathPoint( g.pd[ si ], pj, R( px ), R( py ) )
			return el.setAttribute( 'd', SerializeD( g.pd ) )
		}
		if	( g.pts ) {
			const
			i = +name.slice( 3 )
			const
			[ px, py ] = Pt( inv, ev.clientX, ev.clientY )
			return SetPoints( el, g.pts.map( ( _, j ) => j === i ? [ px, py ] : _ ) )
		}
		const
		[ vx, vy ] = Vec( inv, ev.clientX - g.x0, ev.clientY - g.y0 )
		let
		x = b0.x, y = b0.y, w = b0.width, h = b0.height
		name.includes( 'w' ) && ( x += vx, w -= vx )
		name.includes( 'e' ) && ( w += vx )
		name.includes( 'n' ) && ( y += vy, h -= vy )
		name.includes( 's' ) && ( h += vy )
		w < 1 && ( w = 1 )
		h < 1 && ( h = 1 )
		if	( ev.shiftKey && name.length === 2 && b0.width && b0.height ) {
			h = w * b0.height / b0.width
			name.includes( 'n' ) && ( y = b0.y + b0.height - h )
		}
		switch ( el.localName ) {
		case 'rect'		:
		case 'image'	:
			el.setAttribute( 'x', R( x ) )
		,	el.setAttribute( 'y', R( y ) )
		,	el.setAttribute( 'width', R( w ) )
		,	el.setAttribute( 'height', R( h ) )
			break
		case 'circle'	:
			el.setAttribute( 'cx', R( x + w / 2 ) )
		,	el.setAttribute( 'cy', R( y + h / 2 ) )
		,	el.setAttribute(
				'r'
			,	R( ( name.length === 2 ? Math.max( w, h ) : name === 'e' || name === 'w' ? w : h ) / 2 )
			)
			break
		case 'ellipse'	:
			el.setAttribute( 'cx', R( x + w / 2 ) )
		,	el.setAttribute( 'cy', R( y + h / 2 ) )
		,	el.setAttribute( 'rx', R( w / 2 ) )
		,	el.setAttribute( 'ry', R( h / 2 ) )
			break
		default			: {
			const
			sx = b0.width	? w / b0.width	: 1
		,	sy = b0.height	? h / b0.height	: 1
			el.setAttribute(
				'transform'
			,	`${ g.baseT }translate(${ R( x - b0.x * sx ) } ${ R( y - b0.y * sy ) }) scale(${ R4( sx ) } ${ R4( sy ) })`
			)
		}
		}
	}

	ApplyDraw( g, ev ) {
		const
		[ px, py ] = Pt( g.inv, ev.clientX, ev.clientY )
		g.moved || ( g.moved = Math.hypot( ev.clientX - g.x0, ev.clientY - g.y0 ) > 3 )
		const
		el = g.el
		switch ( g.tool ) {
		case 'rect'		: {
			let
			w = px - g.px, h = py - g.py
			if	( ev.shiftKey ) {
				const
				s = Math.max( Math.abs( w ), Math.abs( h ) )
				w = Math.sign( w || 1 ) * s
				h = Math.sign( h || 1 ) * s
			}
			el.setAttribute( 'x', R( Math.min( g.px, g.px + w ) ) )
		,	el.setAttribute( 'y', R( Math.min( g.py, g.py + h ) ) )
		,	el.setAttribute( 'width', R( Math.abs( w ) ) )
		,	el.setAttribute( 'height', R( Math.abs( h ) ) )
			break
		}
		case 'ellipse'	: {
			let
			rx = Math.abs( px - g.px ) / 2, ry = Math.abs( py - g.py ) / 2
			ev.shiftKey && ( rx = ry = Math.max( rx, ry ) )
			el.setAttribute( 'cx', R( g.px + Math.sign( px - g.px || 1 ) * rx ) )
		,	el.setAttribute( 'cy', R( g.py + Math.sign( py - g.py || 1 ) * ry ) )
		,	el.setAttribute( 'rx', R( rx ) )
		,	el.setAttribute( 'ry', R( ry ) )
			break
		}
		case 'line'		: {
			let
			ex = px, ey = py
			if	( ev.shiftKey ) {
				const
				a = Math.round( Math.atan2( py - g.py, px - g.px ) / ( Math.PI / 4 ) ) * Math.PI / 4
			,	d = Math.hypot( px - g.px, py - g.py )
				ex = g.px + Math.cos( a ) * d
				ey = g.py + Math.sin( a ) * d
			}
			el.setAttribute( 'x2', R( ex ) )
		,	el.setAttribute( 'y2', R( ey ) )
			break
		}
		case 'path'		: {
			const
			last = g.pts[ g.pts.length - 1 ]
			if	( Math.hypot( px - last[ 0 ], py - last[ 1 ] ) > .5 ) {
				g.pts.push( [ px, py ] )
				el.setAttribute( 'd', `M ${ g.pts.map( _ => `${ R( _[ 0 ] ) } ${ R( _[ 1 ] ) }` ).join( ' L ' ) }` )
			}
			break
		}
		}
	}

	Up( ev ) {
		const
		g = this.gesture
		if	( !g ) return
		this.gesture = null
		switch ( g.type ) {
		case 'move'		:
			if	( g.moved ) {
				g.items.forEach( _ => _.base.transform === undefined || Bake( _.el ) )
				Commit( 'Move', g.before, g.beforeSel )
			} else if	( g.cycle ) {
				//	Static click on an already-selected element: collapse a
				//	multi-selection to it, else cycle up to the parent group
				//	( and from the top back down to the deepest child ).
				if	( this.selected.length > 1 ) { this.Select( [ g.cycle.el ] ); break }
				const
				p = g.cycle.el.parentNode
				p && p !== this.svg && GRAPHICAL.has( p.localName )
					?	this.Select( [ p ] )
					:	g.cycle.deepest === g.cycle.el || this.Select( [ g.cycle.deepest ] )
			}
			break
		case 'marquee'	: {
			const
			sel = this.MarqueeHits( g )
			this.Select( g.add ? [ ...new Set( [ ...this.selected, ...sel ] ) ] : sel )
			break
		}
		case 'resize'	:
			g.baseT === null || Bake( g.el )
			Commit( 'Resize', g.before, g.beforeSel )
			break
		case 'draw'		:
			g.moved
				?	( this.Select( [ g.el ] ), Commit( g.tool[ 0 ].toUpperCase() + g.tool.slice( 1 ), g.before, g.beforeSel ) )
				:	g.el.remove()
			break
		}
		this.Draw()
	}

	MarqueeHits( g ) {
		const
		L = Math.min( g.x0, g.x1 ), T = Math.min( g.y0, g.y1 )
	,	R_ = Math.max( g.x0, g.x1 ), B = Math.max( g.y0, g.y1 )
		return [ ...this.svg.children ].filter(
			el => {
				if	( !GRAPHICAL.has( el.localName ) ) return false
				const
				r = el.getBoundingClientRect()
				return r.width + r.height > 0 && r.left >= L && r.right <= R_ && r.top >= T && r.bottom <= B
			}
		)
	}

	CancelGesture() {
		const
		g = this.gesture
		if	( !g ) return
		this.gesture = null
		g.before && this.SetSVG( Parse( g.before ) )
		this.Draw()
	}

	Escape() {
		this.gesture
			?	this.CancelGesture()
			:	this.selected.length
				?	this.Select( [] )
				:	this.SetTool( 'select' )
	}

	Dbl( ev ) {
		const
		el = this.PickEl( ev.target )
		if	( !el ) return
		const
		tx = el.closest( 'text' )
		if	( tx ) {
			this.Select( [ tx ] )
			window.dispatchEvent( new CustomEvent( 'text-edit', { detail: tx } ) )
		} else this.Select( [ el ] )	//	dive into a group
	}

	Menu( ev ) {
		const
		el = this.PickEl( ev.target )
		if	( !el ) return
		ev.preventDefault()
		const
		t = this.Resolve( el )
		this.selected.includes( t ) || this.Select( [ t ] )
		window.dispatchEvent( new CustomEvent( 'element-menu', { detail: { x: ev.clientX, y: ev.clientY } } ) )
	}

	DeleteSelected() {
		if	( !this.selected.length ) return
		Mutate( 'Delete', () => this.selected.forEach( _ => _.remove() ) )
		this.Select( [] )
	}

	DuplicateSelected() {
		if	( !this.selected.length ) return
		const
		clones = []
		Mutate(
			'Duplicate'
		,	() => this.selected.forEach(
				el => {
					const
					c = el.cloneNode( true )
					StripIDs( c )
					el.after( c )
					const
					m = c.getScreenCTM?.()
					m && ( ApplyMove( { el: c, inv: m.inverse(), base: MoveBase( c ) }, 12, 12 ), Bake( c ) )
					clones.push( c )
				}
			)
		)
		this.Select( clones )
	}

	ToFront() {
		this.selected.length && Mutate( 'Front', () => this.selected.forEach( _ => _.parentNode.append( _ ) ) )
	}

	ToBack() {
		this.selected.length && Mutate(
			'Back'
		,	() => this.selected.forEach(
				_ => {
					const
					first = _.parentNode.firstElementChild
					first && first.localName === 'defs'
						?	first.after( _ )
						:	_.parentNode.prepend( _ )
				}
			)
		)
	}

	//	dx / dy in document units ( arrow-key nudge ).
	Nudge( dx, dy ) {
		if	( !this.selected.length ) return
		const
		m = this.svg.getScreenCTM?.()
		if	( !m ) return
		const
		[ sx, sy ] = Vec( m, dx, dy )
		Mutate(
			'Nudge'
		,	() => this.selected.forEach(
				el => {
					const
					em = el.getScreenCTM?.()
					if	( !em ) return
					const
					base = MoveBase( el )
					ApplyMove( { el, inv: em.inverse(), base }, sx, sy )
					base.transform === undefined || Bake( el )
				}
			)
		)
	}

	CopySelected() {
		if	( !this.selected.length ) return ''
		this.buffer = this.selected.map( _ => _.outerHTML ).join( '\n' )
		navigator.clipboard?.writeText( this.buffer ).catch( () => {} )
		return this.buffer
	}

	//	markup: external clipboard text ( a fragment, or a whole <svg> document —
	//	e.g. a .ve from Kiseki ); omitted → the internal copy buffer
	Paste( markup ) {
		const
		text = ( markup ?? this.buffer ?? '' ).trim().replace( /^<\?xml[^>]*\?>\s*/, '' )
		if	( !text ) return
		const
		doc = new DOMParser().parseFromString(
			/^<svg[\s>]/i.test( text ) ? text : `<svg xmlns="${ SVG_NS }">${ text }</svg>`
		,	'image/svg+xml'
		)
		if	( doc.querySelector( 'parsererror' ) || doc.documentElement.nodeName !== 'svg' ) return
		const
		els = []
		Mutate(
			'Paste'
		,	() => [ ...doc.documentElement.children ].forEach(
				_ => {
					const
					c = document.importNode( _, true )
					StripIDs( c )
					this.svg.append( c )
					const
					m = c.getScreenCTM?.()
					m && ( ApplyMove( { el: c, inv: m.inverse(), base: MoveBase( c ) }, 12, 12 ), Bake( c ) )
					els.push( c )
				}
			)
		)
		this.Select( els )
	}

	Draw() {
		if	( !this.svg ) return
		this.Layout()
		EMPTY_HINT.style.display = [ ...this.svg.children ].some( _ => _.localName !== 'defs' ) ? 'none' : ''
		const
		wr = this.wrap.getBoundingClientRect()
		const
		Box = el => {
			const
			r = el.getBoundingClientRect()
			return [ r.left - wr.left, r.top - wr.top, r.width, r.height ]
		}
		const
		kids = []
		this.selected = this.selected.filter( _ => this.svg.contains( _ ) )
		this.selected.forEach(
			el => {
				const
				[ x, y, w, h ] = Box( el )
				kids.push( NE( 'rect', { x, y, width: w, height: h, class: 'sel-box' } ) )
			}
		)
		this.hover && !this.selected.includes( this.hover ) && this.svg.contains( this.hover ) && ( () => {
			const
			[ x, y, w, h ] = Box( this.hover )
			w + h > 0 && kids.push( NE( 'rect', { x, y, width: w, height: h, class: 'hov-box' } ) )
		} )()
		if	( this.selected.length === 1 ) {
			const
			el = this.selected[ 0 ]
			if	( POINTY.has( el.localName ) ) {
				const
				m = el.getScreenCTM?.()
				m && GetPoints( el ).forEach(
					( [ px, py ], i ) => {
						const
						[ cx, cy ] = Pt( m, px, py )
						kids.push( NE( 'circle', { cx: cx - wr.left, cy: cy - wr.top, r: 4.5, class: 'handle', 'data-handle': `pt-${ i }`, style: 'cursor:move' } ) )
					}
				)
			} else {
				const
				[ x, y, w, h ] = Box( el )
				;[	[ 'nw', x, y ], [ 'n', x + w / 2, y ], [ 'ne', x + w, y ], [ 'e', x + w, y + h / 2 ]
				,	[ 'se', x + w, y + h ], [ 's', x + w / 2, y + h ], [ 'sw', x, y + h ], [ 'w', x, y + h / 2 ]
				].forEach(
					( [ n, hx, hy ] ) => kids.push(
						NE( 'rect', { x: hx - 3.5, y: hy - 3.5, width: 7, height: 7, class: 'handle', 'data-handle': n, style: `cursor:${ HANDLE_CURSORS[ n ] }` } )
					)
				)
				//	Path WYSIWYG: draggable anchors + control points with guide
				//	lines, on top of the bbox handles. Skipped for very dense
				//	paths ( e.g. freehand strokes ) — use the bbox instead.
				if	( el.localName === 'path' ) {
					const
					m = el.getScreenCTM?.()
					const
					pts = m ? PathPoints( AbsD( el.getAttribute( 'd' ) ) ) : []
					pts.length && pts.length <= 240 && (
						pts.forEach(
							_ => {
								if	( !_.ctrl ) return
								const
								[ x1, y1 ] = Pt( m, _.x, _.y )
							,	[ x2, y2 ] = Pt( m, _.ax, _.ay )
								kids.push( NE( 'line', { x1: x1 - wr.left, y1: y1 - wr.top, x2: x2 - wr.left, y2: y2 - wr.top, class: 'ctrl-line' } ) )
							}
						)
					,	pts.forEach(
							_ => {
								const
								[ cx, cy ] = Pt( m, _.x, _.y )
								kids.push( NE(
									'circle'
								,	{	cx		: cx - wr.left
									,	cy		: cy - wr.top
									,	r		: _.ctrl ? 3.5 : 4.5
									,	class	: _.ctrl ? 'handle handle-ctrl' : 'handle'
									,	'data-handle'	: `pd-${ _.i }-${ _.j }`
									,	style	: 'cursor:move'
									}
								) )
							}
						)
					)
				}
			}
		}
		const
		g = this.gesture
		if	( g?.type === 'marquee' ) {
			const
			x = Math.min( g.x0, g.x1 ) - wr.left
		,	y = Math.min( g.y0, g.y1 ) - wr.top
			kids.push( NE( 'rect', { x, y, width: Math.abs( g.x1 - g.x0 ), height: Math.abs( g.y1 - g.y0 ), class: 'marquee' } ) )
		}
		this.overlay.replaceChildren( ...kids )
	}
}

customElements.define( 'svg-editor', EzuEditor )
