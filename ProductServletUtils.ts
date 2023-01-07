import { Mongo } from "./Mongo";
import { ObjectID, ObjectId } from "mongodb";
import _ from "lodash";
import { SearchExpression, OrderExpression } from "./models/SearchExpression";
import { Product } from "./models/Product";

/**
 * The name of the mongo collection for this resource
 */
const COLLECTION_NAME = 'product';

export namespace ProductServletUtils {
	/**
	 * 
	 */
	export async function search(searchRequest: SearchExpression) {
		const defaultMaxPageSize = 1000;

		/**
		 * 
		 */
		const translateSortExpression = (sortExpression: OrderExpression) => {
			return {
				[sortExpression.field]:
					sortExpression.order === "ASC" ? -1 : sortExpression.order === "DESC" ? 1 : -1
			};
		};

		/**
		 * 
		 */
		const translateFilterExpression = (filterExpression: any) => {
			return _(filterExpression)
				.mapValues((filterValue, key) => {
					if ( key === "userId") {
						return filterValue;
					}
					return `.*${filterValue}.*`;
				})
				.value();
		};

		const connection = await Mongo.getConnection();
		try {
			// Captures events where user omits the desired page size or when
			// the user is stupid and says they want 0 rows per page.
			const pageSize = searchRequest.pageSize || defaultMaxPageSize;

			// Mongo understands pagination by offsetting the results by literal number
			// of records. This translates a single-digit page to its equivalent in row numbers.
			const pageOffset = searchRequest.page >= 1 ? pageSize * searchRequest.page : 0;

			const collection = await Mongo.getCollection(connection, COLLECTION_NAME);

			const productSearchQuery = collection
				.find(
					searchRequest.filterExpression
						? translateFilterExpression(searchRequest.filterExpression)
						: {},
					{
						/*sort:
							searchRequest.orderBy &&
							translateSortExpression(searchRequest.orderBy),*/
						limit: pageSize
					}
				)
				.skip(pageOffset);

			const pageInfoQuery = collection.countDocuments(
				searchRequest.filterExpression
					? translateFilterExpression(searchRequest.filterExpression)
					: {},
				{
					/*sort:
						searchRequest.orderBy &&
						translateSortExpression(searchRequest.orderBy),*/
				});

			const data = await productSearchQuery.toArray();
			const count = await pageInfoQuery;

			return {
				data: data,
				pageInfo: {
					currentPage: searchRequest.page,
					totalItems: count,
					totalPages: _.ceil(count / pageSize)
				}
			};
		} catch (error) {
			return {
				status: "failure",
				message: error
			};
		} finally {
			connection.close();
		}
	}

	/**
	 * 
	 */
	export async function getProduct(productId: string) {

		const connection = await Mongo.getConnection();

		const productCollection = await Mongo.getCollection(connection, COLLECTION_NAME);
		const productQuery = (await productCollection.findOne<Product>({ "_id": new ObjectId(productId)}));
		
		if ( productQuery === null) {
			return {
				data: null
			}
		}

		const userCollection = await Mongo.getCollection(connection, "user");
		const userQuery = await userCollection.findOne({ "_id": new ObjectId(productQuery.userId) }, { projection: { "displayName": 1, "_id": 0} });

		return {
			data: {...productQuery, ...userQuery}
		};
	}


	/**
	 * 
	 */
	export async function addProduct(productForPost: Product): Promise<any> {
		const connection = await Mongo.getConnection();

		const collection = await Mongo.getCollection(connection, COLLECTION_NAME);

		const productQuery = await collection.insertOne(productForPost);

		return {
			data: productQuery
		};
	}

	export async function updateProduct(productId: string, productForUpdate: Partial<Product>): Promise<any> {
		const connection = await Mongo.getConnection();

		const collection = await Mongo.getCollection(connection, COLLECTION_NAME);

		const productQuery = await collection.updateOne({ _id: new ObjectId(productId)}, {
			$set: productForUpdate
		});

		return {
			data: productQuery
		};
	}
}