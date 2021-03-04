import { run, join } from '@ember/runloop';
import { defer } from 'rsvp';
import EmberObject from '@ember/object';
import { task } from 'ember-concurrency';
import { module, test } from 'qunit';

module('Unit: task error handling', function() {
  test("explicitly canceling parent task: no errors", function(assert) {
    assert.expect(1);

    let childDefer;
    let Obj = EmberObject.extend({
      parent: task(function * () {
        yield this.child.perform();
      }),

      child: task(function * () {
        childDefer = defer();
        yield childDefer.promise;
      }),
    });

    let obj;
    run(() => {
      obj = Obj.create();
      obj.get('parent').perform();
    });
    assert.ok(childDefer);
    run(() => {
      obj.get('parent').cancelAll();
    });
  });

  test('synchronous errors are caught asynchronously', function(assert) {
    assert.expect(1);

    let Obj = EmberObject.extend({
      throwError: task(function * () {
        throw new Error('This error should be caught')
      }),
    });

    let obj;
    run(()=> {
      join(() => {
        obj = Obj.create();

        obj.throwError.perform().catch(e => {
          debugger;

          assert.equal(
            e.message,
            'This error should be caught',
            'The thrown error was caught'
          );
        })
      });
    })
  })

  test("parent task canceled by restartable policy: no errors", function(assert) {
    assert.expect(1);

    let childDefer;
    let Obj = EmberObject.extend({
      parent: task(function * () {
        yield this.child.perform();
      }).restartable(),

      child: task(function * () {
        childDefer = defer();
        yield childDefer.promise;
      }),
    });

    let obj;
    run(() => {
      obj = Obj.create();
      obj.get('parent').perform();
    });
    assert.ok(childDefer);
    run(() => {
      obj.get('parent').perform();
    });
  });

  test("parent task perform attempt canceled by drop policy: no errors", function(assert) {
    assert.expect(1);

    let childDefer;
    let Obj = EmberObject.extend({
      parent: task(function * () {
        yield this.child.perform();
      }).drop(),

      child: task(function * () {
        childDefer = defer();
        try {
          yield childDefer.promise;
        } catch(e) {
          assert.ok(false);
        }
      }),
    });

    let obj;
    run(() => {
      obj = Obj.create();
      obj.get('parent').perform(1);
    });
    assert.ok(childDefer);

    run(() => {
      obj.get('parent').perform(2);
    });

    run(() => {
      obj.get('parent').cancelAll();
    });
  });
});
