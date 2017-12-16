/*globals describe, it */
const chai = require('chai')
const { expect } = chai
const path = require('path')

const {node, dependency_tree, sort_test_order} = require('../dependency_tree.js')


describe('node', function() {
  it('constructor', function() {
    const new_node = new node('new_node')
    expect(new_node.parent).to.be.null
    expect(new_node.str).to.equal('new_node')
    expect(new_node.children).to.be.an.instanceof(Array)
    expect(new_node.children).to.have.lengthOf(0)
  })

  it('get_root', function() {
    const root_node = new node('parent'),
          child0 = root_node.add_child('child0'),
          child1 = child0.add_child('child1')

    expect(root_node.get_root()).to.equal(root_node)
    expect(child0.get_root()).to.equal(root_node)
    expect(child1.get_root()).to.equal(root_node)
  })

  describe('add_child', function() {
    it('normal add', function() {
      const parent = new node('parent'),
            child0 = parent.add_child('child0'),
            child1 = parent.add_child('child1')

      child0.add_child('child1')

      expect(parent.str).to.equal('parent')
      expect(parent.children).to.have.lengthOf(2)
      expect(parent.parent).to.be.null

      expect(parent.children[0].str).to.equal('child0')
      expect(parent.children[1].str).to.equal('child1')

      expect(child0).to.be.an.instanceof(node)
      expect(child1).to.be.an.instanceof(node)

      expect(child0.str).to.equal('child0')
      expect(child1.str).to.equal('child1')

      expect(child0.parent).to.equal(parent)
      expect(child1.parent).to.equal(parent)
    })

    it('catch circular insert', function() {
      const parent = new node('parent')

      expect(() => {parent.add_child('parent')})
        .to.throw('Root node of parent already constains parent.')

      const child = parent.add_child('child1')

      expect(() => {child.add_child('parent')})
        .to.throw('Root node of child1 already constains parent.')
    })
  })

  describe('add_child_node', function() {
    it('normal add', function() {
      const parent = new node('parent'),
            child = new node('child'),
            duplicate = new node('child')

      const returned = parent.add_child_node(child)

      expect(returned).to.equal(parent)

      expect(parent.children).to.have.lengthOf(1)
      expect(parent.children[0]).to.equal(child)

      expect(child.parent).to.equal(parent)

      parent.add_child_node(duplicate)
    })

    it('catch circular insert', function() {
      const parent = new node('parent')

      expect(() => {parent.add_child_node(parent)})
        .to.throw('Root node of parent already constains parent.')

      const child = parent.add_child('child1')

      expect(() => {child.add_child_node(parent)})
        .to.throw('Root node of child1 already constains parent.')
    })

    it('do not add node if node is already part of a tree', function() {
      const parent1 = new node('parent1')
      const parent2 = new node('parent2')
      const child = new node('child')

      parent1.add_child_node(child)

      expect(() => parent2.add_child_node(child))
        .to.throw(`Child "${child.str}" already has parent "${child.parent.str}"`)
    })
  })

  describe('in_bloodline', function() {
    it('line', function() {
      const tree = new node('l0')
      const l2 = tree.add_child('l1').add_child('l2')

      expect(l2.in_bloodline('l2')).to.be.true
      expect(l2.in_bloodline('l1')).to.be.true
      expect(l2.in_bloodline('l0')).to.be.true

      expect(l2.in_bloodline('l-1')).to.be.false
    })

    it('split', function() {
      const parent = new node('parent'),
            child = parent.add_child('child1')
      parent.add_child('child2')

      expect(child.in_bloodline('child2')).to.be.false
    })
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

    expect(root_node.is_ancestor_of('root_node')).to.be.false
    expect(root_node.is_ancestor_of(root_node)).to.be.false
  })

  it('contains', function() {
    const root_node = new node('root_node')

    const one = root_node.add_child('1')
    one.add_child('11')

    root_node
      .add_child('2')
      .add_child('21')

    expect(root_node.contains('1')).to.be.true
    expect(root_node.contains('11')).to.be.true
    expect(root_node.contains('2')).to.be.true
    expect(root_node.contains('21')).to.be.true

    expect(root_node.contains('not descendant')).to.be.false

    expect(one.contains('11')).to.be.true
    expect(one.contains('2')).to.be.false
    expect(one.contains('21')).to.be.false

    expect(root_node.contains(one)).to.be.true
    expect(root_node.contains(new node(''))).to.be.false

    expect(root_node.contains('root_node')).to.be.true
    expect(root_node.contains(root_node)).to.be.true
  })

  it('root_contains', function() {
    const root_node = new node('root_node')

    const one = root_node.add_child('1')
    one.add_child('11')

    root_node
      .add_child('2')
      .add_child('21')

    expect(root_node.root_contains('1')).to.be.true
    expect(root_node.root_contains('11')).to.be.true

    expect(one.root_contains('1')).to.be.true
    expect(one.root_contains('11')).to.be.true
    expect(one.root_contains('2')).to.be.true
    expect(one.root_contains('21')).to.be.true

    expect(one.root_contains('not descendant')).to.be.false

    expect(one.root_contains('11')).to.be.true

    expect(one.root_contains(one)).to.be.true
    expect(one.root_contains(new node(''))).to.be.false

    expect(one.root_contains('root_node')).to.be.true
    expect(one.root_contains(root_node)).to.be.true
  })

  // describe('shares_subtree', function() {
  //   it('whole tree', function() {
  //     const tree = new node('root')
  //     expect(tree.shares_subtree(tree)).to.equal(tree)

  //     tree.add_child('child')
  //     expect(tree.shares_subtree(tree)).to.equal(tree)
  //   })

  //   it('check child nodes', function() {
  //     const t1 = new node('t')
  //     t1.add_child('c1')
  //     const t2 = new node('t')
  //     t2.add_child('c2')

  //     expect(t1.shares_subtree(t2)).to.equal(null)
  //   })

  //   it('whole in sub', function() {
  //     const t = new node('t'),
  //           sub = t.add_child('sub')

  //     expect(t.shares_subtree(sub)).to.equal(sub)
  //     expect(sub.shares_subtree(t)).to.equal(sub)
  //   })

  //   it('sub sub', function() {
  //     const t1 = new node('t1'),

  //   })
  // })

  it('num_nodes', function() {
    const t = new node('t')
    t.add_child('1').add_child('2')
    t.add_child('3').add_child('4').add_child('5')

    expect(t.num_nodes()).to.equal(6)
  })

  it('flatten', function() {
    const t = new node('t')
    t.add_child('1').add_child('2')
    t.add_child('3').add_child('4').add_child('5')

    const ref = ['t', '1', '2', '3', '4', '5'].sort()
    const flat = t.flatten().sort()

    expect(flat).to.eql(ref)
  })

  it('to_string', function() {
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
    const entry = 'dependency_tree_test_files/pets.js'

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
    const entry = 'dependency_tree_test_files/name.js'

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
    const entry = 'dependency_tree_test_files/pets.js'
    const max_depth = 0

    try {
      await dependency_tree(entry, {max_depth})

      return Promise.reject(new Error('Max depth error not throw.'))
    } catch(err) {
      expect(err.message).to.equal(`Max depth of ${max_depth} exceded.`)
    }
  })

  describe('circular dependency', function() {
    it('should error on circular dependency', async function() {
      const entry = 'dependency_tree_test_files/circular.js'

      try {
        await new Promise((resolve, reject) => {
          dependency_tree(entry).then(resolve).catch(reject)

          setTimeout(() => {
            reject(new Error('Did not find circular dependency (timed out).'))
          }, 100)
        })

        return Promise.reject(new Error('Did not find circular dependency.'))
      } catch(err) {
        const full_entry_path = path.resolve(entry)
        expect(err.message).to.equal(
          `Found circular dependency for ${full_entry_path} with root node of ${full_entry_path}.`
        )
      }
    })

    it('dependency twice in tree but not circular', async function() {
      const entry = 'dependency_tree_test_files/double_require.js',
            second = path.resolve('dependency_tree_test_files/double_require1.js')

      try {
        const tree = await dependency_tree(entry)

        expect(tree.str).to.equal(path.resolve(entry))

        tree.children.forEach(c => {
          expect(c.str).to.equal(second)
        })
      } catch(err) {throw err}
    })
  })

})


describe('sort_test_order', function() {
  it('two dependant trees.', function() {
    const t0 = new node('t0')
    t0.add_child('0').add_child('1')

    const t1 = new node('t1')
    t1.add_child('1')

    const file_to_tree = {
      l0: {src: '0', deptree: t0},
      l1: {src: '1', deptree: t1},
    }

    expect(sort_test_order(file_to_tree)).to.eql(['l1', 'l0'])
  })

  it('three simple linked trees', function() {
    const t0 = new node('t0')
    t0.add_child('0').add_child('1')

    const t1 = new node('t1')
    t1.add_child('1').add_child('2')

    const t2 = new node('t2')
    t2.add_child('2')

    const file_to_tree = {
      l0: {src: '0', deptree: t0},
      l1: {src: '1', deptree: t1},
      l2: {src: '2', deptree: t2},
    }

    expect(sort_test_order(file_to_tree)).to.eql(['l2', 'l1', 'l0'])
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

    const file_to_tree = {
      l0: {src: '0', deptree: t0},
      l2: {src: '2', deptree: t1},
      l5: {src: '5', deptree: t2},
    }

    expect(sort_test_order(file_to_tree)).to.eql(['l5', 'l2', 'l0'])
  })

  it('unrelated trees should be higher priority', function() {
    const t0 = new node('t0')
    t0.add_child('0')
    t0.add_child('1').add_child('2')

    const t1 = new node('t1')
    t1.add_child('2').add_child('3')
    t1.add_child('4')

    const t2 = new node('t2')
    t2.add_child('5')

    const file_to_tree = {
      l0: {src: '0', deptree: t0},
      l2: {src: '2', deptree: t1},
      l5: {src: '5', deptree: t2},
    }

    expect(sort_test_order(file_to_tree)).to.eql(['l5', 'l2', 'l0'])
  })

  it('duel dependency', function() {
    const t0 = new node('t0')
    t0.add_child('0') // duel dependency
    t0.add_child('1').add_child('2')

    const t1 = new node('t1')
    t1.add_child('2').add_child('3')
    t1.add_child('4').add_child('5')
    t1.add_child('0') // duel dependency

    const t2 = new node('t2')
    t2.add_child('5')

    const file_to_tree = {
      l0: {src: '0', deptree: t0},
      l2: {src: '2', deptree: t1},
      l5: {src: '5', deptree: t2},
    }

    expect(sort_test_order(file_to_tree)).to.eql(['l5', 'l0', 'l2'])
  })
})
