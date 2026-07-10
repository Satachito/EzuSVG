import { test, beforeEach }	from 'node:test'
import assert				from 'node:assert/strict'

import Do, { Undo, Redo, ClearJobs, dones, todos }	from '../Jobs.js'

beforeEach( ClearJobs )

test( 'Do records undo/redo and clears the redo stack', () => {
	Do( 'one', async () => {}, async () => {} )
	assert.equal( dones.length, 1 )
	todos.push( { label: 'stale' } )
	Do( 'two', async () => {}, async () => {} )
	assert.equal( todos.length, 0 )
	assert.equal( dones.length, 2 )
} )

test( 'Undo / Redo move entries between stacks', async () => {
	const
	v = { n: 0 }
	Do( 'inc', async () => { v.n = 1 }, async () => { v.n = 0 } )
	await Undo()
	assert.equal( v.n, 0 )
	assert.equal( dones.length, 0 )
	assert.equal( todos.length, 1 )
	await Redo()
	assert.equal( v.n, 1 )
} )
