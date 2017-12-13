/*globals describe, it */

// root node is project
// first level is each object in relations
// second level are its listed files in watch_files, test_file, and dependencies
// lower levels branch out till the file matches the node

const fs = require('then-fs')
const path = require('path')
const bubblesort = require('bubblesort')

function node(str) {
  this.str = str
  this.children = []
}

node.prototype.add_child = function(str) {
  const child = new node(str, this)
  this.children.push(child)
  return child
}

node.prototype.add_child_node = function(node) {
  this.children.push(node)
  return this
}

node.prototype.is_ancestor_of = function(str) {
  if (str instanceof node) str = str.str
  if (this.children.some(child => child.str === str)) return true
  return this.children.some(child => child.is_ancestor_of(str))
}

node.prototype.num_nodes = function() {
  return 1 + this.children.reduce((t, c) => t + c.num_nodes(), 0)
}

node.prototype.to_string = function(indent=0) {
  const strings = []

  const start = `${' '.repeat(indent)}${this.str}`
  if (this.children.length > 0) {
    strings.push(start + `: ${this.children.map(c => c.str).join(', ')}\n`)

    this.children.forEach(c => {
      strings.push(c.to_string(indent + 2))
    })
  }
  else
    strings.push(start + ' -\n')

  return strings.join('')
}


const chai = require('chai')
const { expect } = chai

describe('node', function() {
  it('constructor', function() {
    const new_node = new node('new_node')
    expect(new_node.str).to.equal('new_node')
    expect(new_node.children).to.be.an.instanceof(Array)
    expect(new_node.children).to.have.lengthOf(0)
  })

  it('add_child', function() {
    const parent = new node('parent')
    const child0 = parent.add_child('child0')
    const child1 = parent.add_child('child1')

    expect(parent.str).to.equal('parent')
    expect(parent.children).to.have.lengthOf(2)

    expect(parent.children[0].str).to.equal('child0')
    expect(parent.children[1].str).to.equal('child1')

    expect(child0).to.be.an.instanceof(node)
    expect(child1).to.be.an.instanceof(node)

    expect(child0.str).to.equal('child0')
    expect(child1.str).to.equal('child1')
  })

  it('add_child_node', function() {
    const parent = new node('parent')
    const child = new node('child')

    const returned = parent.add_child_node(child)

    expect(returned).to.equal(parent)

    expect(parent.children).to.have.lengthOf(1)
    expect(parent.children[0]).to.equal(child)
  })

  it('is_ancestor_of', function() {
    const root_node = new node('root_node')

    const one = root_node.add_child('1')
    one.add_child('11')

    root_node
      .add_child('2')
      .add_child('21')

    expect(root_node.is_ancestor_of('1')).to.be.true
    expect(root_node.is_ancestor_of('11')).to.be.true
    expect(root_node.is_ancestor_of('2')).to.be.true
    expect(root_node.is_ancestor_of('21')).to.be.true

    expect(root_node.is_ancestor_of('not descendant')).to.be.false

    expect(one.is_ancestor_of('11')).to.be.true
    expect(one.is_ancestor_of('2')).to.be.false
    expect(one.is_ancestor_of('21')).to.be.false

    expect(root_node.is_ancestor_of(one)).to.be.true
    expect(root_node.is_ancestor_of(new node(''))).to.be.false
  })

  it('num_nodes', function() {
    const t = new node('t')
    t.add_child('1').add_child('2')
    t.add_child('3').add_child('4').add_child('5')

    expect(t.num_nodes()).to.equal(6)
  })

  it('print', function() {
    const t = new node('t')
    t.add_child('1').add_child('2')
    t.add_child('3').add_child('4').add_child('5')

    expect(t.to_string()).to.equal([
      't: 1, 3',
      '  1: 2',
      '    2 -',
      '  3: 4',
      '    4: 5',
      '      5 -',
    ].join('\n') + '\n')
  })
})


async function dependency_tree(entry_file, options={}) {
  const {parent, max_depth=100, depth=0} = options

  if (depth > max_depth) throw new Error(`Max depth of ${max_depth} exceded.`)

  const entry_file_full = path.resolve(entry_file),
        entry_dir = path.dirname(entry_file_full)

  try { await fs.access(entry_file_full) } catch(err) {throw err}

  const [file_node, root_node] = (function() {
    if (parent === undefined) {
      const file_node = new node(entry_file_full)
      return [file_node, file_node]
    }
    return [parent.add_child(entry_file_full), options.root_node]
  })()

  if (file_node !== root_node && root_node.str === entry_file_full)
    throw new Error(`Found circular dependency for ${entry_file_full}`)

  const re = /\brequire\(\w*['"`](.*\.js)['"`]\w*\)/g

  try {
    const file_str = await fs.readFile(entry_file_full)

    let dependency = undefined
    while ((dependency = re.exec(file_str)) !== null) {
      const dep_path = path.join(entry_dir, dependency[1]) // file path
      await dependency_tree(dep_path, {
        root_node,
        parent: file_node,
        max_depth,
        depth: depth + 1,
      })
    }
  } catch(err) {throw err}

  return file_node
}

describe('dependency_tree', function() {
  it('bad file path', async function() {
    const bad_file_path = 'bad_file_path.js'
    try {
      await dependency_tree(bad_file_path)

      return Promise.reject(new Error('Does not fail on bad file path.'))
    } catch (err) {
      expect(err.message).to.equal(`ENOENT: no such file or directory, access '${path.resolve(bad_file_path)}'`)
    }
  })

  it('pets.js', async function() {
    const entry = 'dependancy_tree_test_files/pets.js'

    try {
      const dt = await dependency_tree(entry)

      const entry_dir = path.dirname(path.resolve(entry))
      expect(dt.str).to.equal(path.resolve(entry))

      expect(dt.is_ancestor_of(path.join(entry_dir, 'cat.js'))).to.be.true
      expect(dt.is_ancestor_of(path.join(entry_dir, 'level_2', 'dog.js'))).to.be.true

      expect(dt.is_ancestor_of(path.join(entry_dir, 'level_2', 'name2.js'))).to.be.false
    } catch(err) {throw err}
  })

  it('name.js', async function() {
    const entry = 'dependancy_tree_test_files/name.js'

    try {
      const dt = await dependency_tree(entry)

      const entry_dir = path.dirname(path.resolve(entry))
      expect(dt.str).to.equal(path.resolve(entry))

      expect(dt.is_ancestor_of(path.join(entry_dir, 'level_2', 'name2.js'))).to.be.true
      expect(dt.is_ancestor_of(path.join(entry_dir, 'name3.js'))).to.be.true

      expect(dt.is_ancestor_of(path.join(entry_dir, 'level_2', 'dog.js'))).to.be.false
    } catch(err) {throw err}
  })

  it('max_depth exceded', async function() {
    const entry = 'dependancy_tree_test_files/pets.js'
    const max_depth = 0

    try {
      await dependency_tree(entry, {max_depth})

      return Promise.reject(new Error('Max depth error not throw.'))
    } catch(err) {
      expect(err.message).to.equal(`Max depth of ${max_depth} exceded.`)
    }
  })

  it('should error on circular dependency.', async function() {
    const entry = 'dependancy_tree_test_files/circular.js'

    try {
      await new Promise((resolve, reject) => {
        dependency_tree(entry).then(resolve).catch(reject)

        setTimeout(() => {
          reject(new Error('Did not find circular dependency (timed out).'))
        }, 100)
      })

      return Promise.reject(new Error('Did not find circular dependency.'))
    } catch(err) {
      expect(err.message).to.equal(`Found circular dependency for ${path.resolve(entry)}`)
    }
  })
})


function sort_test_order(dep_trees) {
  const over_dep_order = dep_trees.map(t => t.str)
  const over_dep_trees = {}
  over_dep_order.forEach(t => over_dep_trees[t] = new node(t))

  for (const t in over_dep_trees) {
    if (over_dep_trees.hasOwnProperty(t)) {
    }
  }

  t1_loop:for (let i1 = dep_trees.length - 1; i1 >= 1; --i1) {
    const t1 = dep_trees[i1]

    t2_loop:for (let i2 = i1 - 1; i2 >= 0; --i2) {
      const t2 = dep_trees[i2]

      if (i1 === i2) throw new Error(`i1 and i2 are both ${i1}`)


      const child_loop = function(ancestor, descendant) {
        for (let ci = descendant.children.length - 1; ci >= 0; --ci) {
          const descendant_entry = descendant.children[ci].str

          if (ancestor.is_ancestor_of(descendant_entry)) {
            over_dep_trees[ancestor.str].add_child_node(over_dep_trees[descendant.str])
            break
          }
        }
      }

      child_loop(t1, t2)
      child_loop(t2, t1)
    }
  }

  over_dep_order.sort((a, b) => {
    const an = over_dep_trees[a],
          bn = over_dep_trees[b]
    const a_in_b = bn.is_ancestor_of(a),
          b_in_a = an.is_ancestor_of(b)

    let to_return
    if (a_in_b && b_in_a){
      const a_num = an.num_nodes(), b_num = bn.num_nodes()
      if (a_num < b_num) to_return = -1
      else if (b_num < a_num) to_return = 1
      else to_return = 0
    }
    else if (a_in_b) to_return = -1
    else if (b_in_a) to_return = 1
    else {
      const a_num = an.num_nodes(), b_num = bn.num_nodes()
      if (a_num < b_num) to_return = -1
      else if (b_num < a_num) to_return = 1
      else to_return = 0
    }

    return to_return
  })

  return over_dep_order
}

describe('sort_test_order', function() {
  it('two dependant trees.', function() {
    const t0 = new node('t0')
    t0.add_child('0').add_child('1')

    const t1 = new node('t1')
    t1.add_child('1')

    expect(sort_test_order([t0, t1])).to.eql(['t1', 't0'])
    expect(sort_test_order([t1, t0])).to.eql(['t1', 't0'])
  })

  it('three simple linked trees', function() {
    const t0 = new node('t0')
    t0.add_child('0').add_child('1')

    const t1 = new node('t1')
    t1.add_child('1').add_child('2')

    const t2 = new node('t2')
    t2.add_child('2')

    expect(sort_test_order([t0, t1, t2])).to.eql(['t2', 't1', 't0'])
    expect(sort_test_order([t1, t0, t2])).to.eql(['t2', 't1', 't0'])
    expect(sort_test_order([t1, t2, t0])).to.eql(['t2', 't1', 't0'])
  })

  it('three dependant trees.', function() {
    const t0 = new node('t0')
    t0.add_child('0')
    t0.add_child('1').add_child('2')

    const t1 = new node('t1')
    t1.add_child('2').add_child('3')
    t1.add_child('4').add_child('5')

    const t2 = new node('t2')
    t2.add_child('5')

    expect(sort_test_order([t0, t1, t2])).to.eql(['t2', 't1', 't0'])
    expect(sort_test_order([t1, t0, t2])).to.eql(['t2', 't1', 't0'])
    expect(sort_test_order([t1, t2, t0])).to.eql(['t2', 't1', 't0'])
  })
})

