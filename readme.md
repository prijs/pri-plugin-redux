# pri-plugin-redux &middot; [![npm version](https://img.shields.io/npm/v/pri-plugin-redux.svg?style=flat-square)](https://www.npmjs.com/package/pri-plugin-redux)

We provide `pri-plugin-redux` to redux more easily!

## Usage

```bash
npm i pri-plugin-redux
```

```
.
├── src
│    └── model
│          ├── application.ts      # model file
│          └── user.ts             # model file
└── priconfig.json
```

Let’s try it! For example, create a model named `user`:

**src/models/user.ts**

```typescript
import { ActionType, composeTypes, createAction } from 'iron-redux';

const prefix = 'home';

enum BasicTypes {
  changeName
}

enum FetchTypes {}

const Types = composeTypes({
  prefix,
  BasicTypes,
  FetchTypes
});

export const actions = {
  changeName: createAction(Types.changeName)<never>()
};

export class InitialState {
  public name = '123';
}

/**
 * reducer
 */
export function reducer(state = new InitialState(), action: ActionType<typeof actions>): InitialState {
  switch (action.type) {
    case Types.changeName: {
      return {
        ...state,
        name: '456'
      };
    }

    default: {
      return state;
    }
  }
}
```

Then, use it in pages!

**src/pages/index.tsx**

```tsx
import * as React from 'react';
import { connect } from 'pri/model';

export default connect(state => ({
  name: state.home.name
}))(props => {
  return (
    <div>
      name: {props.name}
      <button onClick={props.home.changeName}>Click</button>
    </div>
  );
});
```
