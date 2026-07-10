import { test }	from 'node:test'
import assert	from 'node:assert/strict'

import {
	ParseD
,	AbsD
,	SerializeD
,	PathPoints
}	from '../PathD.js'

test( 'ParseD reads M/L/Z and implicit L after M', () => {
	assert.deepEqual(
		ParseD( 'M10 20 L30 40 Z' )
	,	[
			{ c: 'M', n: [ 10, 20 ] }
		,	{ c: 'L', n: [ 30, 40 ] }
		,	{ c: 'Z', n: [] }
		]
	)
	assert.deepEqual(
		ParseD( 'M0 0 10 0 10 10' ).map( _ => _.c )
	,	[ 'M', 'L', 'L' ]
	)
} )

test( 'AbsD converts relative and H/V to absolute L', () => {
	assert.deepEqual(
		AbsD( 'M10 10 h20 v30 z' )
	,	[
			{ c: 'M', n: [ 10, 10 ] }
		,	{ c: 'L', n: [ 30, 10 ] }
		,	{ c: 'L', n: [ 30, 40 ] }
		,	{ c: 'Z', n: [] }
		]
	)
} )

test( 'SerializeD round-trips AbsD for a cubic', () => {
	const
	d = 'M0 0 C10 0 10 10 20 10'
	,	abs = AbsD( d )
	assert.equal( SerializeD( abs ), 'M 0 0 C 10 0 10 10 20 10' )
	assert.deepEqual( PathPoints( abs ).length > 0, true )
} )
